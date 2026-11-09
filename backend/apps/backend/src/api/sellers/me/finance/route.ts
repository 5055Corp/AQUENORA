import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { currentCostPrices, ORDER_FIELDS, summarizeSeller, toFinanceOrder, type SellerWithOrders } from "../../../../lib/finance"
import { parseFinanceQuery } from "../../validators"

/**
 * GET /sellers/me/finance?period=7d|30d|all
 * Revenue, cost of goods, fees and profit for the signed-in seller, with a chart series
 * and a per-product breakdown.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { period } = parseFinanceQuery(req.query)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    {
      entity: "seller",
      fields: ["id", "country_code", "currency_code", "products.id", "products.metadata", ...ORDER_FIELDS],
      filters: { id: req.auth_context.actor_id },
    },
    { throwIfKeyNotFound: true }
  )
  const seller = data[0] as unknown as SellerWithOrders
  const summary = summarizeSeller(
    (seller.orders ?? []).filter(Boolean).map(toFinanceOrder),
    seller.country_code,
    period,
    currentCostPrices(seller)
  )
  res.json({ currency_code: seller.currency_code, ...summary })
}
