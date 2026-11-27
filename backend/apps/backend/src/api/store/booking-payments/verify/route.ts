import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { confirmBookingPaymentWorkflow } from "../../../../workflows/bookings"
import type { VerifyPaymentBody } from "../../../sellers/validators"

/** POST /store/booking-payments/verify { reference }: after Paystack, records a booking payment (once). */
export async function POST(req: MedusaRequest<VerifyPaymentBody>, res: MedusaResponse) {
  const { result } = await confirmBookingPaymentWorkflow(req.scope).run({ input: { reference: req.validatedBody.reference } })
  res.json(result)
}
