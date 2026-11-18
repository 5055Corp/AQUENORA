import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { deleteProductsWorkflow, useQueryGraphStep } from "@medusajs/medusa/core-flows"

export type DeleteSellerProductInput = { seller_id: string; product_id: string }

type SellerProducts = { products: ({ id: string } | null)[] }

/** Only the seller's own products can be deleted. */
const checkSellerOwnsProductStep = createStep(
  "check-seller-owns-product",
  async ({ input, seller }: { input: DeleteSellerProductInput; seller: SellerProducts }) => {
    if (!seller.products.some((p) => p?.id === input.product_id)) {
      // Same answer whether the product doesn't exist or belongs to someone else.
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
    }
    return new StepResponse(input.product_id)
  }
)

/**
 * Deletes one of the seller's products: it leaves the store and AQUENORA search straight away.
 * Past orders keep their own copy of the name and price, so order history and Financials don't change.
 */
export const deleteSellerProductWorkflow = createWorkflow(
  "delete-seller-product",
  function (input: DeleteSellerProductInput) {
    const { data: sellers } = useQueryGraphStep({
      entity: "seller",
      fields: ["id", "products.id"],
      filters: { id: input.seller_id },
      options: { throwIfKeyNotFound: true },
    }).config({ name: "get-seller-products-for-delete" })

    const productId = checkSellerOwnsProductStep({ input, seller: sellers[0] as unknown as SellerProducts })
    deleteProductsWorkflow.runAsStep({ input: transform({ productId }, ({ productId }) => ({ ids: [productId] })) })

    return new WorkflowResponse(productId)
  }
)
