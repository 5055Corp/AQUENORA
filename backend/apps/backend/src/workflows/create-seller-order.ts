import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createOrdersStep, createRemoteLinkStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { resolvePlan, type PlanSeller } from "../lib/plans"
import { SELLER_MODULE } from "../modules/seller"
import { upsertMarketingContactStep } from "./steps/marketing-steps"

export type CreateSellerOrderInput = {
  seller_id: string
  email: string
  customer_name?: string
  /** Paid by a card from outside the seller's country (higher Paystack fee). */
  international?: boolean
  /** The buyer ticked "Send me news and offers from this shop" at checkout. */
  marketing_opt_in?: boolean
  /** "pickup" = the buyer collects from the seller's shop (only if the seller offers pickup). */
  fulfillment?: "delivery" | "pickup"
  /** Buyer's phone and delivery address (delivery orders). */
  phone?: string
  address?: string
  city?: string
  region?: string
  postal_code?: string
  /** Delivery country, ISO code (e.g. "CA"). */
  country?: string
  /** The delivery option the buyer chose (price in the seller's currency). */
  shipping?: { id: string; carrier: string; name: string; price: number; days: string }
  /** Currency the buyer saw prices in. */
  display_currency?: string
  /** Set when Paystack took the payment: the real fees are recorded on the order. */
  payment?: {
    reference: string
    /** Paystack's fee, whole units. */
    fee: number | null
    /** AQUENORA's commission actually charged, whole units. */
    platform_fee: number
    /** Commission rate fixed at checkout (wins over the seller's current plan). */
    commission_rate: number
  }
  /** unit_price: the price shown at checkout (defaults to the product's current price). */
  items: { product_id: string; quantity: number; unit_price?: number }[]
  /** Take the sold quantities out of stock (real sales; the demo seed leaves stock alone). */
  reduce_stock?: boolean
}

type SellerWithProducts = {
  id: string
  currency_code: string
  trial_ends_at?: string | null
  pro_paid_until?: string | null
  pickup?: { enabled?: boolean } | null
  products: { id: string; title: string; metadata: Record<string, unknown> | null; variants: { id: string; prices: { amount: number; currency_code: string }[] }[] }[]
}

/** Every item must be one of this seller's own products. */
/** AQUENORA's commission on the seller's plan right now; stored on the order so later plan changes don't rewrite it. */
const sellerCommissionRateStep = createStep(
  "seller-commission-rate",
  async (input: { seller: PlanSeller }, { container }) => {
    const plan = await resolvePlan(container, input.seller)
    return new StepResponse(plan.commission_percent / 100)
  }
)

/** Takes sold items out of stock (metadata.stock); puts them back if the order fails. */
const reduceStockStep = createStep(
  "reduce-stock",
  async (input: { seller: SellerWithProducts; items: CreateSellerOrderInput["items"]; enabled?: boolean }, { container }) => {
    if (!input.enabled) {
      return new StepResponse([], [])
    }
    const productService = container.resolve(Modules.PRODUCT)
    const byId = new Map(input.seller.products.filter(Boolean).map((p) => [p.id, p]))
    const qty = new Map<string, number>()
    for (const i of input.items) {
      qty.set(i.product_id, (qty.get(i.product_id) ?? 0) + i.quantity)
    }
    const before: { id: string; metadata: Record<string, unknown> }[] = []
    for (const [id, n] of qty) {
      const metadata = byId.get(id)?.metadata ?? {}
      const stock = Number(metadata.stock ?? 0)
      before.push({ id, metadata })
      // Paid already, so never refuse here; stock just can't go below zero.
      await productService.updateProducts(id, { metadata: { ...metadata, stock: Math.max(0, (Number.isFinite(stock) ? stock : 0) - n) } })
    }
    return new StepResponse(before, before)
  },
  async (before, { container }) => {
    if (!before?.length) {
      return
    }
    const productService = container.resolve(Modules.PRODUCT)
    for (const p of before) {
      await productService.updateProducts(p.id, { metadata: p.metadata })
    }
  }
)

const checkSellerOrderItemsStep = createStep(
  "check-seller-order-items",
  async (input: { seller: SellerWithProducts; items: CreateSellerOrderInput["items"]; fulfillment?: string }) => {
    if (input.fulfillment === "pickup" && !input.seller.pickup?.enabled) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This store doesn't offer pickup.")
    }
    if (!input.items.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "An order needs at least one item.")
    }
    const own = new Set(input.seller.products.filter(Boolean).map((p) => p.id))
    const foreign = input.items.find((i) => !own.has(i.product_id))
    if (foreign) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Product ${foreign.product_id} isn't sold by this store.`)
    }
    return new StepResponse(true)
  }
)

/**
 * Records a paid order for one seller: the line items keep the price and the product's cost
 * price at the time of sale (so later price or cost changes don't rewrite past profit), and the
 * order is linked to the seller. Paystack checkout (lib/checkout.ts) runs it once a payment is
 * confirmed; the demo seed script uses it too.
 */
export const createSellerOrderWorkflow = createWorkflow(
  "create-seller-order",
  function (input: CreateSellerOrderInput) {
    const { data: sellers } = useQueryGraphStep({
      entity: "seller",
      fields: [
        "id",
        "currency_code",
        "trial_ends_at",
        "pro_paid_until",
        "pickup",
        "products.id",
        "products.title",
        "products.metadata",
        "products.variants.id",
        "products.variants.prices.amount",
        "products.variants.prices.currency_code",
      ],
      filters: { id: input.seller_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-seller-products" })

    const seller = transform({ sellers }, ({ sellers }) => sellers[0] as unknown as SellerWithProducts)
    checkSellerOrderItemsStep({ seller, items: input.items, fulfillment: input.fulfillment })
    const planRate = sellerCommissionRateStep({ seller })
    const commissionRate = transform({ input, planRate }, ({ input, planRate }) => input.payment?.commission_rate ?? planRate)

    const orderData = transform({ input, seller, commissionRate }, ({ input, seller, commissionRate }) => {
      const products = new Map(seller.products.filter(Boolean).map((p) => [p.id, p]))
      const [first, ...rest] = (input.customer_name ?? "").trim().split(/\s+/)
      return [
        {
          email: input.email.trim().toLowerCase(),
          currency_code: seller.currency_code,
          status: "pending",
          shipping_address:
            input.customer_name || input.phone || input.address
              ? {
                  first_name: first || undefined,
                  last_name: rest.join(" ") || undefined,
                  phone: input.phone,
                  address_1: input.fulfillment === "pickup" ? undefined : input.address,
                  city: input.fulfillment === "pickup" ? undefined : input.city,
                  province: input.fulfillment === "pickup" ? undefined : input.region || undefined,
                  postal_code: input.fulfillment === "pickup" ? undefined : input.postal_code || undefined,
                  country_code: input.fulfillment === "pickup" || !input.country ? undefined : input.country.toLowerCase(),
                }
              : undefined,
          metadata: {
            seller_status: "new",
            international: !!input.international,
            marketing_opt_in: !!input.marketing_opt_in,
            commission_rate: commissionRate,
            fulfillment: input.fulfillment === "pickup" ? "pickup" : "delivery",
            ...(input.shipping ? { shipping: input.shipping } : {}),
            ...(input.display_currency ? { display_currency: input.display_currency } : {}),
            ...(input.payment
              ? {
                  paystack_reference: input.payment.reference,
                  payment_fee: input.payment.fee,
                  platform_fee: input.payment.platform_fee,
                }
              : {}),
          },
          items: input.items.map((i) => {
            const p = products.get(i.product_id)!
            const variant = p.variants?.[0]
            const price = variant?.prices?.find((x) => x.currency_code === seller.currency_code) ?? variant?.prices?.[0]
            const cost = Number(p.metadata?.cost_price)
            return {
              title: p.title,
              product_id: p.id,
              variant_id: variant?.id,
              quantity: i.quantity,
              unit_price: i.unit_price ?? Number(price?.amount ?? 0),
              metadata: Number.isFinite(cost) && p.metadata?.cost_price != null ? { cost_price: cost } : {},
            }
          }),
        },
      ]
    })

    reduceStockStep({ seller, items: input.items, enabled: input.reduce_stock })
    const orders = createOrdersStep(orderData)

    const links = transform({ input, orders }, ({ input, orders }) => [
      { [SELLER_MODULE]: { seller_id: input.seller_id }, [Modules.ORDER]: { order_id: orders[0].id } },
    ])
    createRemoteLinkStep(links)

    // Adds the buyer to the shop's customers; subscribes them only if they said yes at checkout.
    upsertMarketingContactStep({
      seller_id: input.seller_id,
      email: input.email,
      name: input.customer_name,
      opt_in: input.marketing_opt_in,
    })

    const order = transform({ orders }, ({ orders }) => orders[0])
    return new WorkflowResponse(order)
  }
)
