import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toDisputeView, type DisputeRecord } from "../../../../lib/disputes"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

/** GET /sellers/me/disputes: problems buyers reported on this seller's orders (newest first). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const rows = await sellers.listDisputes({ seller_id: req.auth_context.actor_id }, { order: { created_at: "DESC" }, take: 200 })
  res.json({ disputes: (rows as unknown as DisputeRecord[]).map(toDisputeView) })
}
