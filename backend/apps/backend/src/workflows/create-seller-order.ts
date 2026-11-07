import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createOrdersStep, createRemoteLinkStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
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
  items: { product_id: string; quantity: number }[]
}

type SellerWithProducts = {
  id: string
  currency_code: string
  products: { id: string; title: string; metadata: Record<string, unknown> | null; variants: { id: string; prices: { amount: number; currency_code: string }[] }[] }[]
}

/** Every item must be one of this seller's own products. */
const checkSellerOrderItemsStep = createStep(
  "check-seller-order-items",
  async (input: { seller: SellerWithProducts; items: CreateSellerOrderInput["items"] }) => {
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
 * order is linked to the seller. Paystack checkout will call this once payment succeeds; for now
 * the demo seed script uses it.
 */
export const createSellerOrderWorkflow = createWorkflow(
  "create-seller-order",
  function (input: CreateSellerOrderInput) {
    const { data: sellers } = useQueryGraphStep({
      entity: "seller",
      fields: [
        "id",
        "currency_code",
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
    checkSellerOrderItemsStep({ seller, items: input.items })

    const orderData = transform({ input, seller }, ({ input, seller }) => {
      const products = new Map(seller.products.filter(Boolean).map((p) => [p.id, p]))
      const [first, ...rest] = (input.customer_name ?? "").trim().split(/\s+/)
      return [
        {
          email: input.email.trim().toLowerCase(),
          currency_code: seller.currency_code,
          status: "pending",
          shipping_address: input.customer_name ? { first_name: first, last_name: rest.join(" ") } : undefined,
          metadata: {
            seller_status: "new",
            international: !!input.international,
            marketing_opt_in: !!input.marketing_opt_in,
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
              unit_price: Number(price?.amount ?? 0),
              metadata: Number.isFinite(cost) && p.metadata?.cost_price != null ? { cost_price: cost } : {},
            }
          }),
        },
      ]
    })

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
