// Pro plan billed monthly by card through Paystack. All of it goes to AQUENORA (no split).
//
//   1. startProCheckout: the seller pays the first month on Paystack's card page.
//   2. confirmProPayment (return page or webhook): Pro is extended by a month and the card is
//      saved as a Paystack "authorization" (a token, never the card number).
//   3. renewDuePro (scheduled job, hourly): about a day before Pro ends, the saved card is
//      charged for the next month at the seller's current price. A failed charge is retried
//      once a day; after MAX_FAILURES the renewal stops and Pro ends with the paid month.
//
// Prices are set per country in the admin (Plans & pricing). AQUENORA's Paystack account can only
// charge in its own currencies (PAYSTACK_ACCOUNT_CURRENCIES, default NGN); other prices are
// converted at today's rate and rounded up.

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"
import { updateSellerWorkflow } from "../workflows/update-seller"
import {
  chargeAuthorization,
  fromSubunit,
  initializePlatformCardPayment,
  newReference,
  toSubunit,
  verifyTransaction,
  type PaystackTransaction,
} from "./paystack"
import { getRates } from "./rates"

export const MAX_FAILURES = 3
const DAY = 24 * 3600 * 1000
/** Renewals start this long before Pro runs out. */
const RENEW_AHEAD = DAY
/** A failed renewal is tried again after this long. */
const RETRY_AFTER = 20 * 3600 * 1000

export type ProBilling = {
  authorization_code?: string
  signature?: string | null
  email?: string
  brand?: string | null
  last4?: string | null
  exp_month?: string | null
  exp_year?: string | null
  auto_renew?: boolean
  failures?: number
  last_error?: string | null
  last_attempt_at?: string | null
}

type BillingSeller = {
  id: string
  email: string
  country_code: string
  pro_paid_until: string | Date | null
  pro_billing: ProBilling | null
}

const SELLER_FIELDS = ["id", "email", "country_code", "pro_paid_until", "pro_billing"]

/** Currencies AQUENORA's Paystack account accepts, upper case. The first is used for conversions. */
export function accountCurrencies(): string[] {
  const list = (process.env.PAYSTACK_ACCOUNT_CURRENCIES || "NGN")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{3}$/.test(c))
  return list.length ? list : ["NGN"]
}

/** What to charge for one month: the seller's price, or that price converted and rounded up. */
export async function monthlyCharge(container: MedusaContainer, countryCode: string) {
  const billing = container.resolve<BillingModuleService>(BILLING_MODULE)
  const price = (await billing.getPrices()).find((p) => p.country_code === countryCode)
  if (!price) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "There's no Pro price for your country yet.")
  }
  const priceCurrency = price.currency_code.toUpperCase()
  const allowed = accountCurrencies()
  if (allowed.includes(priceCurrency)) {
    return { amount: price.monthly_price, currency: priceCurrency, price }
  }
  const { rates } = await getRates()
  const to = allowed[0]
  if (!rates[priceCurrency] || !rates[to]) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Card payment isn't available for your currency yet.")
  }
  const raw = (price.monthly_price / rates[priceCurrency]) * rates[to]
  // Friendly amounts: round up to the next 100 (or next whole unit for small currencies).
  const step = rates[to] > 100 ? 100 : 1
  return { amount: Math.ceil(raw / step) * step, currency: to, price }
}

async function getSeller(container: MedusaContainer, id: string): Promise<BillingSeller> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: SELLER_FIELDS, filters: { id } }, { throwIfKeyNotFound: true })
  return data[0] as unknown as BillingSeller
}

/** The app may only send sellers back to the seller app. */
function allowedReturn(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  const origins = (process.env.SELLER_CORS || "").split(",").map((o) => o.trim()).filter(Boolean)
  return origins.some((o) => {
    try {
      return new URL(o).hostname.toLowerCase() === host
    } catch {
      return false
    }
  })
}

/** Starts paying for Pro by card. Returns Paystack's payment page. */
export async function startProCheckout(container: MedusaContainer, sellerId: string, returnUrl: string) {
  if (!allowedReturn(returnUrl)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid return address.")
  }
  const seller = await getSeller(container, sellerId)
  const charge = await monthlyCharge(container, seller.country_code)
  const reference = "aqp_" + newReference().slice(3)
  const billing = container.resolve<BillingModuleService>(BILLING_MODULE)
  await billing.createProPayments({
    reference,
    seller_id: seller.id,
    kind: "first",
    amount: charge.amount,
    currency_code: charge.currency,
    price_amount: charge.price.monthly_price,
    price_currency_code: charge.price.currency_code,
  })
  const back = new URL(returnUrl)
  back.searchParams.set("pro_reference", reference)
  const page = await initializePlatformCardPayment({
    email: seller.email,
    amount: toSubunit(charge.amount),
    currency: charge.currency,
    reference,
    callback_url: back.toString(),
    metadata: { kind: "pro", seller_id: seller.id },
  })
  return { reference, authorization_url: page.authorization_url, amount: charge.amount, currency_code: charge.currency }
}

/** One month after `from` (or after now, if Pro has already run out). */
function extendFrom(paidUntil: string | Date | null, now = new Date()): Date {
  const start = paidUntil && new Date(paidUntil) > now ? new Date(paidUntil) : now
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return end
}

/** Saves the card from a successful payment, when Paystack says it can be charged again. */
function cardFrom(tx: PaystackTransaction, previous: ProBilling | null): ProBilling {
  const a = tx.authorization
  const reusable = !!a?.authorization_code && a.reusable === true && (a.channel ?? "card") === "card"
  return {
    ...(previous ?? {}),
    ...(reusable
      ? {
          authorization_code: a!.authorization_code,
          signature: a!.signature ?? null,
          email: tx.customer?.email ?? previous?.email,
          brand: a!.brand ?? null,
          last4: a!.last4 ?? null,
          exp_month: a!.exp_month ?? null,
          exp_year: a!.exp_year ?? null,
          auto_renew: true,
        }
      : {}),
    failures: 0,
    last_error: null,
  }
}

/**
 * Confirms a Pro payment with Paystack and extends Pro once. Safe to call from the return page and
 * the webhook: a lock per reference plus the payment's status stop doubles.
 */
export async function confirmProPayment(container: MedusaContainer, reference: string, tx?: PaystackTransaction) {
  const locking = container.resolve(Modules.LOCKING)
  return locking.execute(`pro:${reference}`, () => confirmLocked(container, reference, tx), { timeout: 30 })
}

async function confirmLocked(container: MedusaContainer, reference: string, given?: PaystackTransaction) {
  const billing = container.resolve<BillingModuleService>(BILLING_MODULE)
  const [payment] = await billing.listProPayments({ reference })
  if (!payment) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that payment.")
  }
  if (payment.status === "paid") {
    return { status: "paid" as const, pro_paid_until: payment.period_end }
  }
  // `given` only ever comes from our own server-side call to Paystack (a renewal charge);
  // otherwise (return page, webhook) Paystack is asked directly.
  const tx = given ?? (await verifyTransaction(reference))
  if (tx.status !== "success") {
    const pending = ["ongoing", "pending", "processing", "queued", "abandoned", "send_otp", "send_pin", "send_phone", "send_birthday", "open_url"].includes(tx.status)
    if (!pending) {
      await billing.updateProPayments({ id: payment.id, status: "failed", message: tx.status })
    }
    return { status: pending ? ("pending" as const) : ("failed" as const), message: pending ? "Your payment hasn't gone through yet." : "Your card payment didn't go through." }
  }
  if (tx.amount !== toSubunit(Number(payment.amount)) || tx.currency.toUpperCase() !== payment.currency_code.toUpperCase()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This payment doesn't match the Pro price. Please contact AQUENORA.")
  }
  const seller = await getSeller(container, payment.seller_id)
  const until = extendFrom(seller.pro_paid_until)
  await updateSellerWorkflow(container).run({
    input: { id: seller.id, data: { pro_paid_until: until, pro_billing: cardFrom(tx, seller.pro_billing) as Record<string, unknown> } },
  })
  await billing.updateProPayments({ id: payment.id, status: "paid", period_end: until })
  return { status: "paid" as const, pro_paid_until: until }
}

/** Turns monthly renewal on or off. Off: Pro stays until the paid month ends. */
export async function setAutoRenew(container: MedusaContainer, sellerId: string, on: boolean) {
  const seller = await getSeller(container, sellerId)
  if (on && !seller.pro_billing?.authorization_code) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Pay for Pro by card first, then renewal can be switched on.")
  }
  const next: ProBilling = { ...(seller.pro_billing ?? {}), auto_renew: on, ...(on ? { failures: 0, last_error: null } : {}) }
  await updateSellerWorkflow(container).run({ input: { id: seller.id, data: { pro_billing: next as Record<string, unknown> } } })
}

/** Sellers whose saved card should be charged now. */
export function isDue(s: BillingSeller, now: Date): boolean {
  const b = s.pro_billing
  if (!b?.auto_renew || !b.authorization_code || !s.pro_paid_until) {
    return false
  }
  const ends = new Date(s.pro_paid_until).getTime()
  // From a day before the end, until a few days after it (retries).
  if (now.getTime() < ends - RENEW_AHEAD || now.getTime() > ends + MAX_FAILURES * DAY) {
    return false
  }
  return !b.last_attempt_at || now.getTime() - new Date(b.last_attempt_at).getTime() >= RETRY_AFTER
}

/** Charges every seller whose Pro is due. Returns what happened, for logs and tests. */
export async function renewDuePro(container: MedusaContainer, now = new Date()) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const billing = container.resolve<BillingModuleService>(BILLING_MODULE)
  const { data } = await query.graph({ entity: "seller", fields: SELLER_FIELDS })
  const due = (data as unknown as BillingSeller[]).filter((s) => isDue(s, now))
  const results: { seller_id: string; status: "paid" | "failed"; message?: string }[] = []

  for (const seller of due) {
    const b = seller.pro_billing!
    const attempt: ProBilling = { ...b, last_attempt_at: now.toISOString() }
    try {
      const charge = await monthlyCharge(container, seller.country_code)
      const reference = "aqr_" + newReference().slice(3)
      await billing.createProPayments({
        reference,
        seller_id: seller.id,
        kind: "renewal",
        amount: charge.amount,
        currency_code: charge.currency,
        price_amount: charge.price.monthly_price,
        price_currency_code: charge.price.currency_code,
      })
      // Record the attempt first, so a crash can't cause a second charge within RETRY_AFTER.
      await updateSellerWorkflow(container).run({ input: { id: seller.id, data: { pro_billing: attempt as Record<string, unknown> } } })
      const tx = await chargeAuthorization({
        authorization_code: b.authorization_code!,
        email: b.email || seller.email,
        amount: toSubunit(charge.amount),
        currency: charge.currency,
        reference,
        metadata: { kind: "pro_renewal", seller_id: seller.id },
      })
      const r = await confirmProPayment(container, reference, tx)
      if (r.status === "paid") {
        results.push({ seller_id: seller.id, status: "paid" })
        continue
      }
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "message" in r ? r.message : "Payment not completed")
    } catch (e) {
      const failures = (b.failures ?? 0) + 1
      const message = (e as Error).message || "Card charge failed"
      const stop = failures >= MAX_FAILURES
      await updateSellerWorkflow(container).run({
        input: {
          id: seller.id,
          data: { pro_billing: { ...attempt, failures, last_error: message, auto_renew: !stop } as Record<string, unknown> },
        },
      })
      logger.warn(`Pro renewal for ${seller.id} failed (${failures}/${MAX_FAILURES}): ${message}`)
      results.push({ seller_id: seller.id, status: "failed", message })
    }
  }
  return results
}

/** What the seller app shows about card billing. */
export function billingSummary(seller: { pro_paid_until: string | Date | null; pro_billing: ProBilling | null }) {
  const b = seller.pro_billing
  const auto = !!b?.auto_renew && !!b.authorization_code
  return {
    card: b?.authorization_code ? { brand: b.brand ?? null, last4: b.last4 ?? null, exp_month: b.exp_month ?? null, exp_year: b.exp_year ?? null } : null,
    auto_renew: auto,
    // Renewal happens about a day before Pro runs out.
    next_charge_at: auto && seller.pro_paid_until ? new Date(new Date(seller.pro_paid_until).getTime() - RENEW_AHEAD).toISOString() : null,
    failures: b?.failures ?? 0,
    last_error: b?.last_error ?? null,
  }
}

export const toWhole = fromSubunit
