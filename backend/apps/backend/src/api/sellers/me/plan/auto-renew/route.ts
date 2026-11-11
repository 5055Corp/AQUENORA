import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setAutoRenew } from "../../../../../lib/pro-billing"
import { sellerPlanResponse } from "../../../../../lib/seller-plan-route"
import type { AutoRenewBody } from "../../../validators"

/** POST /sellers/me/plan/auto-renew { on }: stop or restart the monthly card charge. */
export async function POST(req: AuthenticatedMedusaRequest<AutoRenewBody>, res: MedusaResponse) {
  await setAutoRenew(req.scope, req.auth_context.actor_id, req.validatedBody.on)
  res.json(await sellerPlanResponse(req, req.auth_context.actor_id))
}
