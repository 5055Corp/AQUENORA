import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ORDER_FIELDS, type SellerWithOrders } from "../../../../lib/finance"
import { newestFirst, toSellerOrder } from "../../fields"

/** GET /sellers/me/orders: the signed-in seller's orders, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    {
      entity: "seller",
      fields: ["id", ...ORDER_FIELDS, "orders.shipping_address.first_name", "orders.shipping_address.last_name"],
      filters: { id: req.auth_context.actor_id },
    },
    { throwIfKeyNotFound: true }
  )
  const seller = data[0] as unknown as SellerWithOrders
  const orders = newestFirst((seller.orders ?? []).filter(Boolean).map(toSellerOrder))
  res.json({ orders, count: orders.length })
}
