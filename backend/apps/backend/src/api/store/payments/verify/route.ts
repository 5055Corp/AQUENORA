import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { confirmPayment } from "../../../../lib/checkout"
import type { VerifyPaymentBody } from "../../../sellers/validators"

/**
 * POST /store/payments/verify { reference }
 * The store page calls this when Paystack sends the buyer back. Creates the order if the payment
 * went through (once, even if the webhook got there first).
 */
export async function POST(req: MedusaRequest<VerifyPaymentBody>, res: MedusaResponse) {
  res.json(await confirmPayment(req.scope, req.validatedBody.reference))
}
