import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { deleteSellerProductWorkflow } from "../../../../../workflows/delete-seller-product"
import { updateSellerProductWorkflow } from "../../../../../workflows/update-seller-product"
import { PRODUCT_FIELDS, toSellerProduct } from "../../../fields"
import type { UpdateSellerProductBody } from "../../../validators"

/** POST /sellers/me/products/:id: change a product's name, description, price, cost price, stock or photos. */
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

/** DELETE /sellers/me/products/:id: remove a product from the store for good. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteSellerProductWorkflow(req.scope).run({
    input: { seller_id: req.auth_context.actor_id, product_id: req.params.id },
  })
  res.json({ id: req.params.id, deleted: true })
}
