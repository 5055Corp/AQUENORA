import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { bookingPage } from "../../../../../lib/booking-flow"
import { startBookingWorkflow } from "../../../../../workflows/bookings"
import type { StartBookingBody } from "../../../../sellers/validators"

/** GET /store/sellers/:handle/booking: the shop's services, how to pay, address and rules. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(await bookingPage(req.scope, req.params.handle))
}

/** POST /store/sellers/:handle/booking: book a time. Paying online returns Paystack's page (payment_url). */
export async function POST(req: MedusaRequest<StartBookingBody>, res: MedusaResponse) {
  const { result } = await startBookingWorkflow(req.scope).run({ input: { handle: req.params.handle, data: req.validatedBody } })
  res.status(201).json(result)
}
