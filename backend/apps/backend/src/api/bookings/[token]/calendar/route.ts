import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { customerBooking } from "../../../../lib/booking-flow"
import { bookingIdFromToken, icsCalendar, icsEvent, manageUrl } from "../../../../lib/bookings"

/** GET /bookings/:token/calendar: the booking as a calendar file ("Add to my calendar"). No key needed. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = bookingIdFromToken(String(req.params.token ?? "").replace(/\.ics$/, ""))
  if (!id) {
    res.status(404).send("Not found")
    return
  }
  const { booking: b, seller, settings } = await customerBooking(req.scope, id)
  const link = manageUrl(seller.handle, b.id)
  const ics = icsCalendar(`${b.service_name} · ${seller.name}`, [
    icsEvent({ uid: b.id, start: b.starts_at, end: b.ends_at, title: `${b.service_name} · ${seller.name}`, location: settings.address, description: link ? `See or change your booking: ${link}` : undefined, cancelled: b.status === "cancelled" }),
  ])
  res.setHeader("Content-Type", "text/calendar; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="booking-${seller.handle}.ics"`)
  res.send(ics)
}
