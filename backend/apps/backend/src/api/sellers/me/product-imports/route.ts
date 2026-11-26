import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createSellerProductWorkflow } from "../../../../workflows/create-seller-product"
import type { ImportProductsBody } from "../../validators"

/**
 * POST /sellers/me/product-imports { products: [...] }: adds up to 200 products from the seller's
 * spreadsheet. Each row is added on its own, so one bad row doesn't stop the rest.
 */
export async function POST(req: AuthenticatedMedusaRequest<ImportProductsBody>, res: MedusaResponse) {
  const failed: { row: number; title: string; message: string }[] = []
  let created = 0
  for (const [i, product] of req.validatedBody.products.entries()) {
    try {
      await createSellerProductWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, ...product } })
      created++
    } catch (e) {
      failed.push({ row: i + 1, title: product.title, message: e instanceof Error ? e.message : "Could not add it." })
    }
  }
  res.status(created ? 201 : 400).json({ created, failed })
}
