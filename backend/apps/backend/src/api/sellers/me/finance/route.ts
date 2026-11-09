import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLAN_FIELDS, resolvePlan } from "../../../../lib/plans"
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
      fields: ["id", "country_code", "currency_code", ...PLAN_FIELDS, "products.id", "products.metadata", ...ORDER_FIELDS],
      filters: { id: req.auth_context.actor_id },
    },
    { throwIfKeyNotFound: true }
  )
  const seller = data[0] as unknown as SellerWithOrders
  const plan = await resolvePlan(req.scope, seller)
  const summary = summarizeSeller(
    (seller.orders ?? []).filter(Boolean).map(toFinanceOrder),
    seller.country_code,
    period,
    currentCostPrices(seller),
    new Date(),
    plan.commission_percent / 100
  )
  // Free plan: totals only. The charts and profit per product are a Pro feature.
  if (!plan.features.full_financials) {
    return res.json({ currency_code: seller.currency_code, ...summary, series: [], by_product: [], locked: true, plan: plan.plan })
  }
  res.json({ currency_code: seller.currency_code, ...summary, locked: false, plan: plan.plan })
}
