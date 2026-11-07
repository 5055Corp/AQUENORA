import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { currentCostPrices, ORDER_FIELDS, summarizeSeller, toFinanceOrder, type SellerWithOrders } from "../../../../lib/finance"
import { parseFinanceQuery } from "../../../sellers/validators"

/**
 * GET /admin/finance/sellers?period=7d|30d|all  (AQENORA team only: admin login)
 * Every seller's revenue, profit and the commission AQENORA earned from them, plus totals per
 * currency (naira, cedis, rand... can't be added together).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { period } = parseFinanceQuery(req.query)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "email", "country_code", "currency_code", "created_at", "products.id", "products.metadata", ...ORDER_FIELDS],
  })

  const sellers = (data as unknown as SellerWithOrders[]).map((s) => {
    const { totals } = summarizeSeller(
      (s.orders ?? []).filter(Boolean).map(toFinanceOrder),
      s.country_code,
      period,
      currentCostPrices(s)
    )
    return {
      id: s.id,
      name: s.name,
      handle: s.handle,
      email: s.email,
      country_code: s.country_code,
      currency_code: s.currency_code,
      products: (s.products ?? []).filter(Boolean).length,
      orders: totals.orders,
      revenue: totals.revenue,
      cost_of_goods: totals.cost_of_goods,
      payment_fees: totals.payment_fees,
      platform_fees: totals.platform_fees,
      profit: totals.profit,
      items_missing_cost: totals.items_missing_cost,
    }
  })
  sellers.sort((a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name))

  const byCurrency = new Map<string, { currency_code: string; sellers: number; orders: number; revenue: number; profit: number; platform_fees: number }>()
  for (const s of sellers) {
    const t = byCurrency.get(s.currency_code) ?? { currency_code: s.currency_code, sellers: 0, orders: 0, revenue: 0, profit: 0, platform_fees: 0 }
    t.sellers += 1
    t.orders += s.orders
    t.revenue += s.revenue
    t.profit += s.profit
    t.platform_fees += s.platform_fees
    byCurrency.set(s.currency_code, t)
  }

  res.json({ period, sellers, totals_by_currency: [...byCurrency.values()].sort((a, b) => b.revenue - a.revenue) })
}
