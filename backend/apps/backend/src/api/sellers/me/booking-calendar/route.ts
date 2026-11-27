import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sellerCalendarUrl } from "../../../../lib/bookings"
import { bookingCalendarKeyWorkflow } from "../../../../workflows/bookings"

/** POST /sellers/me/booking-calendar { renew? }: the private link that shows bookings in Google / Apple Calendar. */
export async function POST(req: AuthenticatedMedusaRequest<{ renew?: boolean }>, res: MedusaResponse) {
  const renew = (req.body as { renew?: unknown } | undefined)?.renew === true
  const { result: key } = await bookingCalendarKeyWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, renew } })
  const url = sellerCalendarUrl(key)
  res.json({ url, webcal: url.replace(/^https?:/, "webcal:") })
}
