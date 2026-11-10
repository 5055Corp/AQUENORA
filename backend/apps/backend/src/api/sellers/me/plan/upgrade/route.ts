import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sellerPlanResponse } from "../../../../../lib/seller-plan-route"

/**
 * POST /sellers/me/plan/upgrade
 * Paying online needs Paystack subscriptions (not switched on yet). Until then this answers with
 * how to pay by transfer; the AQENORA team then marks the shop as paid in the admin dashboard.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const info = await sellerPlanResponse(req, req.auth_context.actor_id)
  res.status(202).json({
    payment: "manual",
    message: "Online card payment for Pro opens soon. To upgrade now, pay by bank transfer and we'll switch on Pro for you.",
    price: info.price,
    billing_contact: info.billing_contact,
  })
}
