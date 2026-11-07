import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateSellerProductWorkflow } from "../../../../../workflows/update-seller-product"
import { PRODUCT_FIELDS, toSellerProduct } from "../../../fields"
import type { UpdateSellerProductBody } from "../../../validators"

/** POST /sellers/me/products/:id: change a product's name, price, cost price or stock. */
export async function POST(req: AuthenticatedMedusaRequest<UpdateSellerProductBody>, res: MedusaResponse) {
  await updateSellerProductWorkflow(req.scope).run({
    input: { seller_id: req.auth_context.actor_id, product_id: req.params.id, ...req.validatedBody },
  })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: PRODUCT_FIELDS.map((f) => f.replace(/^products\./, "")),
    filters: { id: req.params.id },
  })
  res.json({ product: toSellerProduct(data[0]) })
}
