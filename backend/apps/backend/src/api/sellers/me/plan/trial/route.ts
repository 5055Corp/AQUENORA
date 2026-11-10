import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { planFor } from "../../../../../lib/plans"
import { getSellerRow, sellerPlanResponse } from "../../../../../lib/seller-plan-route"
import { BILLING_MODULE } from "../../../../../modules/billing"
import type BillingModuleService from "../../../../../modules/billing/service"
import { updateSellerWorkflow } from "../../../../../workflows/update-seller"

/** POST /sellers/me/plan/trial: start the free Pro trial (once per shop). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const seller = await getSellerRow(req, req.auth_context.actor_id)
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  const settings = await billing.getSettings()
  const plan = planFor(seller, settings)
  if (plan.status === "paid") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "You're already on Pro.")
  }
  if (plan.trial_used) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Your free trial has already been used. Upgrade to keep Pro.")
  }
  if (settings.trial_days <= 0) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Free trials aren't available right now.")
  }
  await updateSellerWorkflow(req.scope).run({
    input: { id: seller.id, data: { trial_ends_at: new Date(Date.now() + settings.trial_days * 86400000) } },
  })
  res.json(await sellerPlanResponse(req, seller.id))
}
