import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { inviteLink } from "../../../../lib/referrals"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

/** GET /sellers/me/referrals: the seller's invite link, how many joined, and how many free months they've earned. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const me = await sellers.retrieveSeller(req.auth_context.actor_id, { select: ["id", "handle"] })
  const joined = await sellers.listSellers({ referred_by: me.id } as never, { take: 1000, select: ["id", "referral_rewarded_at"] })
  res.json({
    link: inviteLink(me.handle),
    joined: joined.length,
    rewarded: joined.filter((s) => (s as unknown as { referral_rewarded_at: Date | null }).referral_rewarded_at).length,
  })
}
