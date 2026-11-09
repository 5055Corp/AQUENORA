import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateProductsWorkflow, updateProductVariantsWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"

export type UpdateSellerProductInput = {
  seller_id: string
  product_id: string
  title?: string
  /** Selling price in the seller's currency (whole units). */
  price?: number
  /** What one item costs the seller to make or buy. null clears it. */
  cost_price?: number | null
  stock?: number
}

type OwnedProduct = {
  id: string
  metadata: Record<string, unknown> | null
  variants: { id: string }[]
}

type SellerProducts = { currency_code: string; products: (OwnedProduct | null)[] }

/** Finds the product among the seller's own and works out the update (metadata is merged, not replaced). */
const prepareSellerProductUpdateStep = createStep(
  "prepare-seller-product-update",
  async ({ input, seller }: { input: UpdateSellerProductInput; seller: SellerProducts }) => {
    const product = seller.products.find((p) => p?.id === input.product_id)
    if (!product) {
      // Same answer whether the product doesn't exist or belongs to someone else.
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
    }
    const metadata = { ...(product.metadata ?? {}) }
    if (input.stock !== undefined) {
      metadata.stock = input.stock
    }
    if (input.cost_price !== undefined) {
      metadata.cost_price = input.cost_price
    }
    return new StepResponse({
      product,
      currency_code: seller.currency_code,
      productUpdate: {
        selector: { id: product.id },
        update: { ...(input.title !== undefined ? { title: input.title } : {}), metadata },
      },
    })
  }
)

/** Updates one of the seller's own products: name, price, cost price and stock. */
export const updateSellerProductWorkflow = createWorkflow(
  "update-seller-product",
  function (input: UpdateSellerProductInput) {
    const { data: sellers } = useQueryGraphStep({
      entity: "seller",
      fields: ["id", "currency_code", "products.id", "products.metadata", "products.variants.id"],
      filters: { id: input.seller_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-seller-products" })

    const ctx = prepareSellerProductUpdateStep({ input, seller: sellers[0] as unknown as SellerProducts })

    updateProductsWorkflow.runAsStep({ input: ctx.productUpdate })

    when({ input, ctx }, ({ input, ctx }) => input.price !== undefined && ctx.product.variants.length > 0).then(() => {
      const variantUpdate = transform({ input, ctx }, ({ input, ctx }) => ({
        selector: { id: ctx.product.variants[0].id },
        update: { prices: [{ amount: input.price!, currency_code: ctx.currency_code }] },
      }))
      updateProductVariantsWorkflow.runAsStep({ input: variantUpdate })
    })

    return new WorkflowResponse(ctx.product.id)
  }
)
