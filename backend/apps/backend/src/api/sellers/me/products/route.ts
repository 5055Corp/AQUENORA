import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createSellerProductWorkflow } from "../../../../workflows/create-seller-product"
import { newestFirst, PRODUCT_FIELDS, toSellerProduct } from "../../fields"
import type { CreateSellerProductBody } from "../../validators"

/** GET /sellers/me/products: the signed-in seller's products, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    {
      entity: "seller",
      fields: ["id", ...PRODUCT_FIELDS],
      filters: { id: req.auth_context.actor_id },
    },
    { throwIfKeyNotFound: true }
  )
  const products = newestFirst((data[0].products ?? []).filter(Boolean).map(toSellerProduct))
  res.json({ products, count: products.length })
}

/** POST /sellers/me/products: add a product, priced in the seller's currency. */
export async function POST(req: AuthenticatedMedusaRequest<CreateSellerProductBody>, res: MedusaResponse) {
  const { result } = await createSellerProductWorkflow(req.scope).run({
    input: { seller_id: req.auth_context.actor_id, ...req.validatedBody },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: PRODUCT_FIELDS.map((f) => f.replace(/^products\./, "")),
    filters: { id: result.id },
  })
  res.status(201).json({ product: toSellerProduct(data[0]) })
}
