import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { audienceCounts, pastCustomers } from "../../../../lib/customers"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

export const CUSTOMER_ORDER_FIELDS = [
  "orders.status",
  "orders.email",
  "orders.created_at",
  "orders.shipping_address.first_name",
  "orders.shipping_address.last_name",
  "orders.items.quantity",
  "orders.items.unit_price",
]

/** GET /sellers/me/customers: everyone who bought from the shop, and how many each campaign group would reach. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    { entity: "seller", fields: ["id", ...CUSTOMER_ORDER_FIELDS], filters: { id: req.auth_context.actor_id } },
    { throwIfKeyNotFound: true }
  )
  const marketing: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
  const contacts = await marketing.listMarketingContacts({ seller_id: req.auth_context.actor_id })
  const orders = ((data[0] as unknown as { orders?: unknown[] | null }).orders ?? []).filter(Boolean)
  const customers = pastCustomers(orders, contacts)
  res.json({ customers, count: customers.length, audiences: audienceCounts(customers) })
}
