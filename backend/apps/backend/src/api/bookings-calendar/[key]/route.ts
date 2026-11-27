import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { bookingSettingsOf, icsCalendar, icsEvent, type BookingRow } from "../../../lib/bookings"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/**
 * GET /bookings-calendar/:key.ics: the provider's bookings as a calendar feed, for Google or Apple
 * Calendar ("subscribe"). The key is long and private; the provider can make a new one in the app.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const key = String(req.params.key ?? "").replace(/\.ics$/, "")
  if (!/^[a-z0-9_]{20,80}$/i.test(key)) {
    res.status(404).send("Not found")
    return
  }
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const [seller] = await sellers.listSellers({ booking_settings: { calendar_key: key } } as never, { take: 1 })
  if (!seller) {
    res.status(404).send("Not found")
    return
  }
  const settings = bookingSettingsOf(seller as never)
  const now = Date.now()
  const rows = (await sellers.listBookings(
    { seller_id: seller.id, starts_at: { $gte: new Date(now - 30 * 86400000), $lte: new Date(now + 365 * 86400000) }, status: ["confirmed", "completed", "no_show", "cancelled"] } as never,
    { take: 3000 }
  )) as unknown as BookingRow[]
  const ics = icsCalendar(`${seller.name} bookings`, rows.map((b) =>
    icsEvent({
      uid: b.id, start: b.starts_at, end: b.ends_at, title: `${b.customer_name}: ${b.service_name}`, location: settings.address,
      description: `${b.phone} · ${b.email}${b.note ? `\nNote: ${b.note}` : ""}`, cancelled: b.status === "cancelled",
    })
  ))
  res.setHeader("Content-Type", "text/calendar; charset=utf-8")
  res.setHeader("Cache-Control", "no-cache")
  res.send(ics)
}
