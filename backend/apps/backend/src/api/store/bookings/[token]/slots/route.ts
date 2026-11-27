import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { rescheduleSlots } from "../../../../../lib/booking-flow"
import { bookingIdFromToken } from "../../../../../lib/bookings"

/** GET /store/bookings/:token/slots?date=YYYY-MM-DD: free times to move this booking to. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = bookingIdFromToken(String(req.params.token ?? ""))
  if (!id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that booking.")
  res.json({ slots: await rescheduleSlots(req.scope, id, String(req.query.date ?? "")) })
}
