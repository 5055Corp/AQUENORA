import { Modules } from "@medusajs/framework/utils"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  createProductsWorkflow,
  createRemoteLinkStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"
import { SELLER_MODULE } from "../modules/seller"

export type CreateSellerProductInput = {
  seller_id: string
  title: string
  /** Price in the seller's currency, in whole units (e.g. 28000 for NGN 28,000). */
  price: number
  description?: string
  /** How many the seller has. Kept in product metadata until real inventory is set up. */
  stock?: number
}

/**
 * Adds a product to a seller's store: one variant, priced in the seller's currency,
 * published in the default sales channel, and linked to the seller.
 */
export const createSellerProductWorkflow = createWorkflow(
  "create-seller-product",
  function (input: CreateSellerProductInput) {
    const { data: sellers } = useQueryGraphStep({
      entity: "seller",
      fields: ["id", "currency_code"],
      filters: { id: input.seller_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-seller" })

    const { data: stores } = useQueryGraphStep({
      entity: "store",
      fields: ["id", "default_sales_channel_id"],
    }).config({ name: "get-store" })

    const productInput = transform({ input, sellers, stores }, ({ input, sellers, stores }) => {
      const stock = input.stock ?? 1
      const salesChannelId = stores[0]?.default_sales_channel_id
      return {
        products: [
          {
            title: input.title,
            description: input.description,
            status: "published" as const,
            options: [{ title: "Default", values: ["Default"] }],
            variants: [
              {
                title: "Default",
                options: { Default: "Default" },
                manage_inventory: false,
                prices: [{ amount: input.price, currency_code: sellers[0].currency_code }],
              },
            ],
            sales_channels: salesChannelId ? [{ id: salesChannelId }] : [],
            metadata: { stock },
          },
        ],
      }
    })

    const products = createProductsWorkflow.runAsStep({ input: productInput })

    const links = transform({ input, products }, ({ input, products }) => [
      {
        [SELLER_MODULE]: { seller_id: input.seller_id },
        [Modules.PRODUCT]: { product_id: products[0].id },
      },
    ])
    createRemoteLinkStep(links)

    const product = transform({ products }, ({ products }) => products[0])
    return new WorkflowResponse(product)
  }
)
