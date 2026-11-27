import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/** GET /admin/sellers?q=adire: find stores by name, web address or email (newest first, 30 at most). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const q = String(req.query.q ?? "").trim().toLowerCase().slice(0, 80)
  const like = { $ilike: `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` }
  const rows = await sellers.listSellers(
    (q ? { $or: [{ name: like }, { handle: like }, { email: like }] } : {}) as never,
    {
      select: ["id", "name", "handle", "email", "country_code", "verification_status", "suspended_at", "suspend_reason", "pro_paid_until", "created_at"],
      order: { created_at: "DESC" },
      take: 30,
    }
  )
  res.json({ sellers: rows })
}
