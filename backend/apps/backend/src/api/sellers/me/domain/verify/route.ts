import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { domainPointsHere } from "../../../../../lib/domains"
import { getSellerRow, sellerPlanResponse } from "../../../../../lib/seller-plan-route"
import { updateSellerWorkflow } from "../../../../../workflows/update-seller"

/** POST /sellers/me/domain/verify: check whether the domain's records point at AQENORA yet. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const seller = await getSellerRow(req, req.auth_context.actor_id)
  if (!seller.custom_domain) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Add your domain first.")
  }
  const connected = await domainPointsHere(seller.custom_domain)
  if (connected && !seller.domain_verified_at) {
    await updateSellerWorkflow(req.scope).run({ input: { id: seller.id, data: { domain_verified_at: new Date() } } })
  }
  res.json({ connected, ...(await sellerPlanResponse(req, seller.id)) })
}
