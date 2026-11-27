import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

/** GET /sellers/me/stock-alerts: how many shoppers are waiting, by product and choice ("" = the product). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const rows = await req.scope.resolve<SellerModuleService>(SELLER_MODULE).listStockAlerts({ seller_id: req.auth_context.actor_id, status: "waiting" }, { take: 5000, select: ["product_id", "choice"] })
  const waiting: Record<string, Record<string, number>> = {}
  for (const r of rows) {
    waiting[r.product_id] ??= {}
    waiting[r.product_id][r.choice] = (waiting[r.product_id][r.choice] ?? 0) + 1
  }
  res.json({ waiting })
}
