import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { BILLING_MODULE } from "../../../../../modules/billing"
import type BillingModuleService from "../../../../../modules/billing/service"
import { confirmProPayment } from "../../../../../lib/pro-billing"
import { sellerPlanResponse } from "../../../../../lib/seller-plan-route"
import type { ProConfirmBody } from "../../../validators"

/** POST /sellers/me/plan/confirm { reference }: after Paystack sends the seller back. */
export async function POST(req: AuthenticatedMedusaRequest<ProConfirmBody>, res: MedusaResponse) {
  const billing = req.scope.resolve<BillingModuleService>(BILLING_MODULE)
  const [payment] = await billing.listProPayments({ reference: req.validatedBody.reference })
  // Sellers can only confirm their own payments.
  if (!payment || payment.seller_id !== req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that payment.")
  }
  const result = await confirmProPayment(req.scope, payment.reference)
  res.json({ ...result, ...(await sellerPlanResponse(req, req.auth_context.actor_id)) })
}
