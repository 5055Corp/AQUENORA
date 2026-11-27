import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { customerBooking } from "../../../../lib/booking-flow"
import { bookingIdFromToken } from "../../../../lib/bookings"
import { customerBookingActionWorkflow } from "../../../../workflows/bookings"
import type { CustomerBookingActionBody } from "../../../sellers/validators"

const idOf = (token: unknown) => {
  const id = bookingIdFromToken(String(token ?? ""))
  if (!id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that booking.")
  return id
}

/** GET /store/bookings/:token: the customer's booking (from their private link). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const r = await customerBooking(req.scope, idOf(req.params.token))
  res.json({ booking: r.view, online: r.online, fee_percent: r.fee_percent })
}

/** POST /store/bookings/:token { action: cancel | reschedule | pay_balance | tip }. */
export async function POST(req: MedusaRequest<CustomerBookingActionBody>, res: MedusaResponse) {
  const { result } = await customerBookingActionWorkflow(req.scope).run({ input: { booking_id: idOf(req.params.token), data: req.validatedBody } })
  res.json(result)
}
