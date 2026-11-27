// Buying extra emails (website only). Paid by card to AQUENORA; the emails are added once Paystack confirms.
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { emailAllowance } from "./email-allowance"
import { initializePlatformCardPayment, newEmailReference, PAYSTACK_CURRENCY, toSubunit, verifyTransaction } from "./paystack"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

export async function startEmailPurchase(c: MedusaContainer, sellerId: string, count: number, returnUrl: string) {
  const sellers = c.resolve<SellerModuleService>(SELLER_MODULE)
  const seller = await sellers.retrieveSeller(sellerId)
  const currency = PAYSTACK_CURRENCY[seller.country_code]
  if (!currency) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Buying emails isn't available in your country yet.")
  const { price_per_email } = await emailAllowance(c, seller as never)
  const amount = Math.round(price_per_email * count * 100) / 100
  const reference = newEmailReference()
  await c.resolve<BillingModuleService>(BILLING_MODULE).createEmailPurchases({ reference, seller_id: seller.id, count, amount, currency_code: seller.currency_code } as never)
  const back = new URL(returnUrl)
  back.searchParams.set("emails", reference)
  const page = await initializePlatformCardPayment({
    email: seller.email, amount: toSubunit(amount), currency, reference, callback_url: back.toString(), metadata: { seller_id: seller.id, kind: "emails", count },
  })
  return { payment_url: page.authorization_url, amount, currency_code: seller.currency_code }
}

/** Adds the emails once (from the seller's return or the webhook). */
export async function confirmEmailPurchase(c: MedusaContainer, reference: string, sellerId?: string) {
  return c.resolve(Modules.LOCKING).execute(`paystack:${reference}`, async () => {
    const billing = c.resolve<BillingModuleService>(BILLING_MODULE)
    const [p] = await billing.listEmailPurchases({ reference })
    if (!p || (sellerId && p.seller_id !== sellerId)) throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that payment.")
    const sellers = c.resolve<SellerModuleService>(SELLER_MODULE)
    if (p.status === "paid") return { status: "paid" as const, count: p.count, credits: Number((await sellers.retrieveSeller(p.seller_id)).email_credits) }
    const tx = await verifyTransaction(reference)
    if (tx.status !== "success") return { status: "pending" as const, count: p.count, credits: null }
    if (tx.amount !== toSubunit(Number(p.amount)) || tx.currency.toLowerCase() !== p.currency_code.toLowerCase()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This payment doesn't match. Please contact AQUENORA support.")
    }
    await billing.updateEmailPurchases({ id: p.id, status: "paid" } as never)
    const seller = await sellers.retrieveSeller(p.seller_id)
    const credits = (Number(seller.email_credits) || 0) + p.count
    await sellers.updateSellers({ id: seller.id, email_credits: credits } as never)
    return { status: "paid" as const, count: p.count, credits }
  }, { timeout: 30 })
}
