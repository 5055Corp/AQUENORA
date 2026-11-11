import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { paystackEnabled } from "../../../../../lib/paystack"
import { startProCheckout } from "../../../../../lib/pro-billing"
import type { ProCheckoutBody } from "../../../validators"

/**
 * POST /sellers/me/plan/upgrade { return_url }
 * Starts paying for Pro by card: returns Paystack's payment page. The card is then charged
 * automatically each month (see lib/pro-billing.ts).
 */
export async function POST(req: AuthenticatedMedusaRequest<ProCheckoutBody>, res: MedusaResponse) {
  if (!paystackEnabled()) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Card payments for Pro aren't switched on yet.")
  }
  res.json(await startProCheckout(req.scope, req.auth_context.actor_id, req.validatedBody.return_url))
}
