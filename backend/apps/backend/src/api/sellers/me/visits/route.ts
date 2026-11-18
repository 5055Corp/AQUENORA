import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { dayOf, summarizeVisits } from "../../../../lib/visits"

/** GET /sellers/me/visits: store visits this week (by day and source) and last week's total. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const since = dayOf(new Date(Date.now() - 14 * 86400000))
  const rows = await sellers.listStoreVisits({ seller_id: req.auth_context.actor_id, day: { $gte: since } } as never, { take: 500 })
  res.json({ visits: summarizeVisits(rows as unknown as { day: string; source: string; count: number }[]) })
}
