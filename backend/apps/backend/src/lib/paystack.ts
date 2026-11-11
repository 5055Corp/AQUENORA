// Paystack API client: banks, subaccounts (one per seller) and split payments.
//
// How money is split on every sale (Paystack does it; AQUENORA never holds sellers' money):
//   - `subaccount`         the seller's subaccount: the sale settles to the seller's bank account.
//   - `transaction_charge` AQUENORA's commission (3% Free / 1% Pro) as a flat amount, settled to the
//                          AQUENORA (main) Paystack account.
//   - `bearer: subaccount` Paystack's own fee comes out of the seller's share.
// So the seller receives: total - AQUENORA commission - Paystack fee.
//
// Settings (environment): PAYSTACK_SECRET_KEY (sk_test_... or sk_live_...). PAYSTACK_API_URL is only
// for tests (a fake Paystack server).

import crypto from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

const apiUrl = () => (process.env.PAYSTACK_API_URL || "https://api.paystack.co").replace(/\/$/, "")
const secret = () => process.env.PAYSTACK_SECRET_KEY || ""

export const paystackEnabled = () => !!secret()

/** Currencies Paystack can take payments in, by seller country. Senegal isn't supported by Paystack yet. */
export const PAYSTACK_CURRENCY: Record<string, string | null> = {
  NG: "NGN",
  GH: "GHS",
  ZA: "ZAR",
  CI: "XOF",
  SN: null,
  DI: "USD",
}

/** Paystack amounts are in the currency's smallest unit (kobo, pesewas, cents): x100. */
export const toSubunit = (amount: number) => Math.round(amount * 100)
export const fromSubunit = (amount: number) => Math.round(amount) / 100

type PaystackResponse<T> = { status: boolean; message: string; data: T }

async function call<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown): Promise<T> {
  if (!paystackEnabled()) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Online payments aren't switched on yet.")
  }
  let res: Response
  try {
    res = await fetch(apiUrl() + path, {
      method,
      headers: { authorization: `Bearer ${secret()}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Couldn't reach Paystack. Please try again.")
  }
  const json = (await res.json().catch(() => null)) as PaystackResponse<T> | null
  if (!res.ok || !json?.status) {
    // Paystack's messages are written for people ("Could not resolve account name..."): pass them on.
    const msg = json?.message || "Paystack couldn't complete that. Please try again."
    throw new MedusaError(res.status >= 500 ? MedusaError.Types.UNEXPECTED_STATE : MedusaError.Types.INVALID_DATA, msg)
  }
  return json.data
}

export type Bank = { name: string; code: string }

export async function listBanks(currency: string): Promise<Bank[]> {
  const data = await call<{ name: string; code: string; active?: boolean }[]>(
    "GET",
    `/bank?currency=${encodeURIComponent(currency)}&perPage=200`
  )
  const seen = new Set<string>()
  return data
    .filter((b) => b.active !== false && b.code && !seen.has(b.code) && seen.add(b.code))
    .map((b) => ({ name: b.name, code: b.code }))
}

/** Account holder's name for a bank account (Nigeria and Ghana); null where Paystack can't check. */
export async function resolveAccount(accountNumber: string, bankCode: string): Promise<string | null> {
  const data = await call<{ account_name: string }>(
    "GET",
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  )
  return data.account_name || null
}

export type SubaccountInput = {
  business_name: string
  settlement_bank: string
  account_number: string
  /** Fallback commission if a payment doesn't set transaction_charge (we always set it). */
  percentage_charge: number
  primary_contact_email?: string
}

export async function createSubaccount(input: SubaccountInput): Promise<{ subaccount_code: string; account_name?: string | null }> {
  return call("POST", "/subaccount", input)
}

export async function updateSubaccount(code: string, input: SubaccountInput): Promise<{ subaccount_code: string; account_name?: string | null }> {
  return call("PUT", `/subaccount/${encodeURIComponent(code)}`, input)
}

export type InitializeInput = {
  email: string
  /** Subunits. */
  amount: number
  currency: string
  reference: string
  callback_url: string
  subaccount: string
  /** AQUENORA's commission, subunits. */
  transaction_charge: number
  metadata: Record<string, unknown>
}

export async function initializeTransaction(input: InitializeInput) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("POST", "/transaction/initialize", {
    ...input,
    bearer: "subaccount",
  })
}

export type PaystackTransaction = {
  id: number
  status: string
  reference: string
  /** Subunits. */
  amount: number
  currency: string
  /** Paystack's fee, subunits. */
  fees: number | null
  customer?: { email?: string }
  authorization?: { country_code?: string | null }
  subaccount?: { subaccount_code?: string } | null
  metadata: unknown
}

export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  return call("GET", `/transaction/verify/${encodeURIComponent(reference)}`)
}

/** Paystack signs webhooks with HMAC-SHA512 of the raw body, keyed with the secret key. */
export function validWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!paystackEnabled() || !signature) {
    return false
  }
  const expected = crypto.createHmac("sha512", secret()).update(rawBody).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export const newReference = () => "aq_" + crypto.randomBytes(12).toString("hex")
