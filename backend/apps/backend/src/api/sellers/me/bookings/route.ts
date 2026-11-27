import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sellerBookings } from "../../../../lib/booking-flow"
import { addManualBookingWorkflow } from "../../../../workflows/bookings"
import type { ManualBookingBody } from "../../validators"
import { bookingSettingsOf, localDate, sellerView } from "../../../../lib/bookings"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

const date = (v: unknown, fallback: Date) => {
  const d = typeof v === "string" ? new Date(v) : fallback
  return Number.isNaN(d.getTime()) ? fallback : d
}

/** GET /sellers/me/bookings?from=&to=: bookings (default: last 7 days to 60 days ahead) and simple numbers. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const now = new Date()
  const from = date(req.query.from, new Date(now.getTime() - 7 * 86400000))
  const to = date(req.query.to, new Date(now.getTime() + 60 * 86400000))
  if (to.getTime() - from.getTime() > 400 * 86400000) {
    res.status(400).json({ message: "Ask for up to a year at a time." })
    return
  }
  const seller = await req.scope.resolve<SellerModuleService>(SELLER_MODULE).retrieveSeller(req.auth_context.actor_id)
  const settings = bookingSettingsOf(seller as never)
  const rows = await sellerBookings(req.scope, req.auth_context.actor_id, from, to)
  const today = localDate(now, settings.timezone)
  const live = rows.filter((b) => b.status !== "cancelled")
  const weekEnd = now.getTime() + 7 * 86400000
  res.json({
    bookings: rows.map(sellerView),
    stats: {
      today: live.filter((b) => localDate(new Date(b.starts_at), settings.timezone) === today).length,
      next_7_days: live.filter((b) => new Date(b.starts_at).getTime() >= now.getTime() && new Date(b.starts_at).getTime() < weekEnd).length,
      paid_online: Math.round(live.reduce((a, b) => a + Number(b.paid), 0) * 100) / 100,
      tips: Math.round(live.reduce((a, b) => a + Number(b.tips), 0) * 100) / 100,
      refunds_due: rows.filter((b) => Number(b.refund_due) > 0 && !b.refunded_at).length,
    },
    timezone: settings.timezone,
  })
}

/** POST /sellers/me/bookings: add a walk-in, phone or WhatsApp booking by hand. */
export async function POST(req: AuthenticatedMedusaRequest<ManualBookingBody>, res: MedusaResponse) {
  const { result } = await addManualBookingWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, data: req.validatedBody } })
  res.status(201).json({ booking: result })
}
