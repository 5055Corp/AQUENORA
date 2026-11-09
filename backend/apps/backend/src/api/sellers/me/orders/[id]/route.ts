import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ORDER_FIELDS } from "../../../../../lib/finance"
import { updateSellerOrderStatusWorkflow } from "../../../../../workflows/update-seller-order-status"
import { toSellerOrder } from "../../../fields"
import type { UpdateSellerOrderBody } from "../../../validators"

/** POST /sellers/me/orders/:id: mark an order as shipped, then delivered. */
export async function POST(req: AuthenticatedMedusaRequest<UpdateSellerOrderBody>, res: MedusaResponse) {
  await updateSellerOrderStatusWorkflow(req.scope).run({
    input: { seller_id: req.auth_context.actor_id, order_id: req.params.id, status: req.validatedBody.status },
  })
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [...ORDER_FIELDS, "orders.shipping_address.first_name", "orders.shipping_address.last_name"].map((f) => f.replace(/^orders\./, "")),
    filters: { id: req.params.id },
  })
  res.json({ order: toSellerOrder(data[0]) })
}
