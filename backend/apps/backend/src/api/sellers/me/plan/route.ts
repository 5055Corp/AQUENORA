import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sellerPlanResponse } from "../../../../lib/seller-plan-route"

/** GET /sellers/me/plan: the seller's plan, Pro price in their currency, trial and domain status. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json(await sellerPlanResponse(req, req.auth_context.actor_id))
}
