// Email blasts: every seller gets free emails each month (billing setting free_emails_per_month,
// default 100); after that each email costs extra_email_price_ngn (default ₦20), from emails the
// seller bought in advance (email_credits). Bought on the website (App Store rule 3.1.1).

import type { MedusaContainer } from "@medusajs/framework/types"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"
import { getRates } from "./rates"

export type EmailUsage = { month: string; sent: number } | null

export const monthKey = (now = new Date()) => now.toISOString().slice(0, 7)

/** What a seller can send now: free emails left this month, bought emails, and the price of one more. */
export async function emailAllowance(container: MedusaContainer, seller: { email_usage?: unknown; email_credits?: unknown; currency_code: string }, now = new Date()) {
  const settings = await container.resolve<BillingModuleService>(BILLING_MODULE).getSettings()
  const usage = (seller.email_usage ?? null) as EmailUsage
  const used = usage?.month === monthKey(now) ? Number(usage.sent) || 0 : 0
  const free = settings.free_emails_per_month
  const price = await emailPrice(settings.extra_email_price_ngn, seller.currency_code)
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return {
    free_per_month: free,
    used_this_month: used,
    free_left: Math.max(0, free - used),
    credits: Math.max(0, Number(seller.email_credits) || 0),
    price_per_email: price,
    currency_code: seller.currency_code,
    resets_at: next.toISOString(),
  }
}

/** The naira price in the seller's currency (rounded to cents). */
export async function emailPrice(ngn: number, currency: string): Promise<number> {
  const c = currency.toUpperCase()
  if (c === "NGN") return ngn
  const { rates } = await getRates()
  const r = rates[c] && rates.NGN ? (ngn * rates[c]) / rates.NGN : ngn
  return Math.max(0.01, Math.round(r * 100) / 100)
}

/** How a send of `count` emails is paid: free first, then bought emails. Null if there aren't enough. */
export function splitSend(count: number, a: { free_left: number; credits: number }) {
  const free = Math.min(count, a.free_left)
  const paid = count - free
  return paid > a.credits ? null : { free, paid }
}
