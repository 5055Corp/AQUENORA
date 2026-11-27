import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { confirmEmailsWorkflow } from "../../../../../workflows/email-credits"
import type { VerifyPaymentBody } from "../../../validators"

/** POST /sellers/me/email-credits/verify { reference }: after Paystack, adds the emails (once). */
export async function POST(req: AuthenticatedMedusaRequest<VerifyPaymentBody>, res: MedusaResponse) {
  const { result } = await confirmEmailsWorkflow(req.scope).run({ input: { reference: req.validatedBody.reference, seller_id: req.auth_context.actor_id } })
  res.json(result)
}
