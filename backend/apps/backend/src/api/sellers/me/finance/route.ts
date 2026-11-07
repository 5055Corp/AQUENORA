import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ORDER_FIELDS, summarizeSeller, toFinanceOrder } from "../../../../lib/finance"
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
  const seller = data[0]
  const costs = new Map<string, number>()
  for (const p of seller.products ?? []) {
    const c = p?.metadata?.cost_price
    if (p && c != null && c !== "" && Number.isFinite(Number(c))) {
      costs.set(p.id, Number(c))
    }
  }
  const summary = summarizeSeller(
    (seller.orders ?? []).filter(Boolean).map(toFinanceOrder),
    seller.country_code as "NG",
    period,
    costs
  )
  res.json({ currency_code: seller.currency_code, ...summary })
}
