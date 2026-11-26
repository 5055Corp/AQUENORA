// Buyer checkout with Paystack split payments.
//
//   1. startCheckout: checks the bag against the seller's products and stock, saves a "pending"
//      checkout, and asks Paystack for a payment page. The payment is split by Paystack:
//      seller's subaccount gets the sale minus AQUENORA's commission (transaction_charge) and minus
//      Paystack's fee (bearer: subaccount).
//   2. The buyer pays on Paystack's page and comes back to the store (callback_url ?reference=...).
//   3. confirmPayment runs from the return page (POST /store/payments/verify) and from Paystack's
//      webhook (POST /paystack/webhook), whichever is first. It asks Paystack whether the payment
//      really succeeded for the right amount, then creates exactly one order.

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import type { CheckoutBody } from "../api/sellers/validators"
import { PRODUCT_FIELDS, toSellerProduct } from "../api/sellers/fields"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { createSellerOrderWorkflow } from "../workflows/create-seller-order"
import {
  fromSubunit,
  initializeTransaction,
  newReference,
  PAYSTACK_CURRENCY,
  paystackEnabled,
  payoutCountries,
  toSubunit,
  verifyTransaction,
  type PaystackTransaction,
} from "./paystack"
import { resolvePlan } from "./plans"
import { WORLD_BY_CODE } from "./countries"
import { homeCountry, optionsFor, type Shipping } from "../modules/seller/shipping"
import { availableStock, madeToOrderDays, notePrompt, priceWithChoices } from "./product-options"
import { renderOrderConfirmation, ordersFrom } from "./order-email"
import { trackToken, trackUrl } from "./order-tracking"
import { supportEmail } from "./account-email"

type CheckoutSeller = {
  id: string
  name: string
  handle: string
  email: string
  country_code: string
  currency_code: string
  custom_domain?: string | null
  paystack_subaccount_code?: string | null
  verification_status?: string | null
  suspended_at?: string | Date | null
  pickup?: { enabled?: boolean; address?: string; area?: string } | null
  sells_abroad?: boolean
  shipping?: Shipping | null
  trial_ends_at?: string | null
  pro_paid_until?: string | null
  products?: unknown[]
}

/** What a checkout keeps until the payment is confirmed. */
type CheckoutData = {
  email: string
  name: string
  phone: string
  fulfillment: "delivery" | "pickup"
  address?: string
  city?: string
  region?: string
  postal_code?: string
  country?: string
  shipping?: { id: string; carrier: string; name: string; price: number; days: string }
  display_currency?: string
  marketing_opt_in: boolean
  items: {
    product_id: string
    title: string
    quantity: number
    unit_price: number
    /** What the buyer chose, e.g. [{ name: "Length", value: "20 inch" }]. */
    options?: { name: string; value: string }[]
    /** Index of the first option's choice (stock per choice). */
    first_choice?: number | null
    /** Measurements or special requests. */
    note?: string
    /** Made to order: days to make it. */
    made_to_order_days?: number | null
  }[]
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Why a store can't take payments right now, or null if it can. */
export function paymentsBlocker(seller: Pick<CheckoutSeller, "country_code" | "paystack_subaccount_code" | "verification_status"> & { suspended_at?: string | Date | null }): string | null {
  // Paused by AQUENORA (moderation): no payments at all.
  if (seller.suspended_at) {
    return "This shop is unavailable right now."
  }
  if (!paystackEnabled()) {
    return "Paying online isn't switched on yet."
  }
  if (!PAYSTACK_CURRENCY[seller.country_code] || !payoutCountries().has(seller.country_code)) {
    return "Paying online for this shop is coming soon."
  }
  // Only sellers AQUENORA has verified can take money (anti-scam).
  if (seller.verification_status !== "verified") {
    return "This shop is finishing its verification. Check back soon."
  }
  if (!seller.paystack_subaccount_code) {
    return "This shop hasn't set up payments yet."
  }
  return null
}

async function sellerByHandle(container: MedusaContainer, handle: string): Promise<CheckoutSeller> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "name",
      "handle",
      "email",
      "country_code",
      "currency_code",
      "custom_domain",
      "paystack_subaccount_code",
      "verification_status",
      "suspended_at",
      "pickup",
      "sells_abroad",
      "shipping",
      "trial_ends_at",
      "pro_paid_until",
      ...PRODUCT_FIELDS,
    ],
    filters: { handle },
  })
  const seller = data[0] as unknown as CheckoutSeller | undefined
  if (!seller) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `No store at ${handle}`)
  }
  return seller
}

/** Paystack may only send buyers back to a store page: our own domains or the seller's domain. */
function allowedReturnUrl(url: string, seller: CheckoutSeller): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return false
  }
  const storeDomain = (process.env.STORE_DOMAIN || "").toLowerCase().replace(/^\.+|\.+$/g, "")
  if (storeDomain && (host === storeDomain || host.endsWith("." + storeDomain))) {
    return true
  }
  const own = seller.custom_domain?.toLowerCase()
  if (own && (host === own || host === `www.${own}`)) {
    return true
  }
  const origins = (process.env.STORE_CORS || "").split(",").map((o) => o.trim()).filter(Boolean)
  return origins.some((o) => {
    try {
      return new URL(o).hostname.toLowerCase() === host
    } catch {
      return false
    }
  })
}

export async function startCheckout(container: MedusaContainer, handle: string, body: CheckoutBody) {
  const seller = await sellerByHandle(container, handle)
  const blocker = paymentsBlocker(seller)
  if (blocker) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, blocker)
  }
  if (body.fulfillment === "pickup" && !seller.pickup?.enabled) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This store doesn't offer pickup.")
  }
  if (!allowedReturnUrl(body.return_url, seller)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid return address.")
  }

  // Prices and stock come from the server, never from the buyer's browser.
  const products = new Map((seller.products ?? []).filter(Boolean).map((p) => {
    const sp = toSellerProduct(p)
    return [sp.id, sp]
  }))
  // Same product with the same choices and note = one line.
  const lines = new Map<string, { product_id: string; quantity: number; choices?: string[]; note?: string }>()
  for (const i of body.items) {
    const note = i.note?.trim() || undefined
    const key = JSON.stringify([i.product_id, (i.choices ?? []).map((c) => c.trim().toLowerCase()), note ?? ""])
    const line = lines.get(key)
    if (line) line.quantity += i.quantity
    else lines.set(key, { product_id: i.product_id, quantity: i.quantity, choices: i.choices, note })
  }
  const items: CheckoutData["items"] = []
  // Stock is checked across lines: two lengths of one wig share its stock unless each length has its own.
  const wanted = new Map<string, number>()
  for (const line of lines.values()) {
    const p = products.get(line.product_id)
    if (!p || p.status !== "published" || p.hidden) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Something in your bag is no longer for sale. Please remove it and try again.")
    }
    const raw = (seller.products ?? []).find((x) => (x as { id?: string } | null)?.id === p.id) as { metadata?: Record<string, unknown> | null }
    const metadata = raw?.metadata ?? null
    const priced = priceWithChoices({ title: p.title, price: p.price, metadata }, line.choices)
    const left = availableStock({ stock: p.stock, metadata }, priced.first_choice)
    const stockKey = `${p.id}:${p.options?.stock_per_choice ? priced.first_choice : ""}`
    const total = (wanted.get(stockKey) ?? 0) + line.quantity
    wanted.set(stockKey, total)
    if (total > left) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        left > 0 ? `Only ${left} left of ${priced.title}.` : `${priced.title} is sold out.`
      )
    }
    items.push({
      product_id: p.id,
      title: priced.title,
      quantity: line.quantity,
      unit_price: priced.unit_price,
      ...(priced.options.length ? { options: priced.options, first_choice: priced.first_choice } : {}),
      // Notes only for products that ask for them.
      ...(line.note && notePrompt(metadata) ? { note: line.note } : {}),
      ...(madeToOrderDays(metadata) ? { made_to_order_days: madeToOrderDays(metadata) } : {}),
    })
  }

  const itemsTotal = round2(items.reduce((a, i) => a + i.quantity * i.unit_price, 0))
  if (itemsTotal <= 0) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Your bag is empty.")
  }
  const shipping = body.fulfillment === "delivery" ? chooseShipping(seller, body) : undefined
  // The buyer pays for the items plus delivery; AQUENORA's commission is on the items only.
  const amount = round2(itemsTotal + (shipping?.price ?? 0))
  const plan = await resolvePlan(container, seller)
  const rate = plan.commission_percent / 100
  const platformFee = round2(itemsTotal * rate)
  const currency = PAYSTACK_CURRENCY[seller.country_code]!
  const reference = newReference()

  const data: CheckoutData = {
    email: body.email.toLowerCase(),
    name: body.name,
    phone: body.phone,
    fulfillment: body.fulfillment,
    address: body.fulfillment === "delivery" ? body.address : undefined,
    city: body.fulfillment === "delivery" ? body.city : undefined,
    region: body.fulfillment === "delivery" ? body.region : undefined,
    postal_code: body.fulfillment === "delivery" ? body.postal_code : undefined,
    country: body.fulfillment === "delivery" ? body.country : undefined,
    shipping,
    display_currency: body.display_currency,
    marketing_opt_in: body.marketing_opt_in,
    items,
  }
  const sellers = container.resolve<SellerModuleService>(SELLER_MODULE)
  await sellers.createCheckouts({
    reference,
    seller_id: seller.id,
    currency_code: seller.currency_code,
    amount,
    platform_fee: platformFee,
    commission_rate: rate,
    data,
  })

  const callback = new URL(body.return_url)
  callback.searchParams.set("reference", reference)
  const page = await initializeTransaction({
    email: data.email,
    amount: toSubunit(amount),
    currency,
    reference,
    callback_url: callback.toString(),
    subaccount: seller.paystack_subaccount_code!,
    transaction_charge: toSubunit(platformFee),
    metadata: {
      seller: seller.handle,
      fulfillment: data.fulfillment,
      // Shown on the Paystack dashboard.
      custom_fields: [
        { display_name: "Shop", variable_name: "shop", value: seller.name },
        { display_name: "Items", variable_name: "items", value: items.map((i) => `${i.title} x${i.quantity}`).join(", ") },
      ],
    },
  })
  return { reference, authorization_url: page.authorization_url, amount, currency_code: seller.currency_code }
}

/**
 * The delivery option for this buyer's country. A shop with no delivery options arranges
 * delivery with the buyer in its own country only.
 */
function chooseShipping(seller: CheckoutSeller, body: CheckoutBody): CheckoutData["shipping"] {
  const country = body.country!
  const where = WORLD_BY_CODE.get(country)
  if (!where) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Choose your country from the list.")
  }
  const home = homeCountry(seller)
  if (country !== home && seller.sells_abroad === false) {
    const homeName = home ? WORLD_BY_CODE.get(home)?.name : null
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, homeName ? `This shop only delivers within ${homeName}.` : "This shop doesn't deliver abroad.")
  }
  const options = optionsFor(seller, country)
  if (!(seller.shipping?.options ?? []).length && country === home) {
    return undefined
  }
  if (!options.length) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `This shop doesn't deliver to ${where.name} yet.`)
  }
  const chosen = options.find((o) => o.id === body.shipping_option_id)
  if (!chosen) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Choose a delivery option.")
  }
  return { id: chosen.id, carrier: chosen.carrier, name: chosen.name, price: chosen.price, days: chosen.days }
}

export type ConfirmResult =
  | { status: "paid"; order: { id: string; display_id: number }; checkout: CheckoutSummary; track_token: string }
  | { status: "pending" | "failed"; message: string; checkout: CheckoutSummary | null }

type CheckoutSummary = {
  reference: string
  seller_handle?: string
  amount: number
  currency_code: string
  fulfillment: "delivery" | "pickup"
  items: CheckoutData["items"]
  shipping?: CheckoutData["shipping"]
}

/**
 * Confirms a Paystack payment and creates its order once. Safe to call many times, from the
 * return page and from webhooks: a lock per reference plus the checkout's status stop doubles.
 */
export async function confirmPayment(container: MedusaContainer, reference: string): Promise<ConfirmResult> {
  const locking = container.resolve(Modules.LOCKING)
  return locking.execute(`paystack:${reference}`, () => confirmLocked(container, reference), { timeout: 30 })
}

async function confirmLocked(container: MedusaContainer, reference: string): Promise<ConfirmResult> {
  const sellers = container.resolve<SellerModuleService>(SELLER_MODULE)
  const [checkout] = await sellers.listCheckouts({ reference })
  if (!checkout) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that payment.")
  }
  const data = checkout.data as unknown as CheckoutData
  const amount = Number(checkout.amount)
  const summary: CheckoutSummary = {
    reference,
    amount,
    currency_code: checkout.currency_code,
    fulfillment: data.fulfillment,
    items: data.items,
    shipping: data.shipping,
  }

  if (checkout.status === "paid" && checkout.order_id) {
    return { status: "paid", order: await orderRef(container, checkout.order_id), checkout: summary, track_token: trackToken(checkout.order_id) }
  }

  const tx: PaystackTransaction = await verifyTransaction(reference)
  if (tx.status !== "success") {
    const pending = ["ongoing", "pending", "processing", "queued", "abandoned"].includes(tx.status)
    return {
      status: pending ? "pending" : "failed",
      message: pending ? "Your payment hasn't gone through yet." : "Your payment didn't go through. You haven't been charged.",
      checkout: summary,
    }
  }
  // The amount and currency must match what we asked for.
  if (tx.amount !== toSubunit(amount) || tx.currency.toLowerCase() !== currencyFor(checkout.currency_code)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This payment doesn't match the order. Please contact the shop.")
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: rows } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "country_code"],
    filters: { id: checkout.seller_id },
  })
  const seller = rows[0] as unknown as { id: string; name: string; handle: string; country_code: string }
  summary.seller_handle = seller.handle
  const cardCountry = tx.authorization?.country_code?.toUpperCase()
  const international = !!cardCountry && seller.country_code !== "DI" && cardCountry !== seller.country_code

  const { result: order } = await createSellerOrderWorkflow(container).run({
    input: {
      seller_id: checkout.seller_id,
      email: data.email,
      customer_name: data.name,
      phone: data.phone,
      address: data.address,
      city: data.city,
      region: data.region,
      postal_code: data.postal_code,
      country: data.country,
      shipping: data.shipping,
      display_currency: data.display_currency,
      international,
      marketing_opt_in: data.marketing_opt_in,
      fulfillment: data.fulfillment,
      items: data.items.map((i) => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        title: i.title,
        options: i.options,
        first_choice: i.first_choice,
        note: i.note,
      })),
      reduce_stock: true,
      payment: {
        reference,
        fee: tx.fees == null ? null : fromSubunit(tx.fees),
        platform_fee: Number(checkout.platform_fee),
        commission_rate: checkout.commission_rate,
      },
    },
  })
  await sellers.updateCheckouts({ id: checkout.id, status: "paid", order_id: order.id })
  await emailBuyer(container, { seller, data, order, currency: checkout.currency_code })
  return { status: "paid", order: { id: order.id, display_id: order.display_id }, checkout: summary, track_token: trackToken(order.id) }
}

/** Seller currency codes are lowercase Medusa codes ("ngn"); Paystack's are upper case. */
const currencyFor = (code: string) => code.toLowerCase()

async function orderRef(container: MedusaContainer, id: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "display_id"], filters: { id } })
  const o = data[0] as unknown as { id: string; display_id: number }
  return { id: o.id, display_id: o.display_id }
}

/** "Order confirmed" email with the tracking link. A failed email never undoes the order. */
async function emailBuyer(
  container: MedusaContainer,
  input: { seller: { name: string; handle: string }; data: CheckoutData; order: { id: string; display_id: number }; currency: string }
) {
  try {
    const days = Math.max(0, ...input.data.items.map((i) => i.made_to_order_days ?? 0))
    const email = renderOrderConfirmation({
      shopName: input.seller.name,
      buyerName: input.data.name,
      orderNo: input.order.display_id,
      currency: input.currency,
      items: input.data.items,
      shipping: input.data.shipping ?? null,
      pickup: input.data.fulfillment === "pickup",
      madeToOrderDays: days || null,
      trackUrl: trackUrl(input.seller.handle, input.order.id),
    })
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: input.data.email,
      channel: "email",
      template: "aquenora-order-confirmed",
      from: ordersFrom(),
      data: { ...email, reply_to: supportEmail() },
    })
  } catch (e) {
    container.resolve(ContainerRegistrationKeys.LOGGER).warn(`Order confirmation email failed for ${input.order.id}: ${(e as Error).message}`)
  }
}
