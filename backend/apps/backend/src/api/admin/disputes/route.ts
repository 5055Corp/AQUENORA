import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toDisputeView, type DisputeRecord } from "../../../lib/disputes"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/** GET /admin/disputes?status=active|escalated|resolved|all: problems reported by buyers, with the shop's name. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const status = String(req.query.status ?? "active")
  const filter =
    status === "all" ? {} : status === "resolved" ? { status: "resolved" } : status === "escalated" ? { status: "escalated" } : { status: ["open", "replied", "refunded", "escalated"] }
  const rows = (await sellers.listDisputes(filter as never, { order: { created_at: "DESC" }, take: 200 })) as unknown as DisputeRecord[]
  const shops = await sellers.listSellers({ id: [...new Set(rows.map((r) => r.seller_id))] }, { select: ["id", "name", "handle", "email", "suspended_at"] })
  const byId = new Map(shops.map((s) => [s.id, s]))
  res.json({
    disputes: rows.map((r) => ({ ...toDisputeView(r), buyer_email: r.buyer_email, buyer_name: r.buyer_name, seller: byId.get(r.seller_id) ?? null })),
  })
}
