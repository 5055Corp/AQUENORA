// Reminder emails: the day before (about 24 hours) and about 2 hours before each appointment.
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { supportEmail } from "./account-email"
import { bookingReminderEmail, bookingSettingsOf, type BookingRow } from "./bookings"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { markBookingsRemindedWorkflow } from "../workflows/bookings"

const H = 3600000

export async function sendBookingReminders(container: MedusaContainer, now = Date.now()) {
  const sellers = container.resolve<SellerModuleService>(SELLER_MODULE)
  const sent = { day: 0, hour: 0 }
  for (const kind of ["day", "hour"] as const) {
    const [from, to] = kind === "day" ? [now + 20 * H, now + 26 * H] : [now + 1 * H, now + 2.5 * H]
    const rows = (await sellers.listBookings(
      { status: "confirmed", starts_at: { $gte: new Date(from), $lte: new Date(to) }, [kind === "day" ? "reminded_day_at" : "reminded_hour_at"]: null } as never,
      { take: 500 }
    )) as unknown as BookingRow[]
    // Booked very recently: they don't need a reminder yet (the confirmation just went out).
    const due = rows.filter((b) => new Date(b.starts_at).getTime() - new Date(b.created_at ?? 0).getTime() > (kind === "day" ? 26 * H : 3 * H))
    if (!due.length) continue
    const shops = new Map((await sellers.listSellers({ id: [...new Set(due.map((b) => b.seller_id))] })).map((s) => [s.id, s]))
    const mails = due.flatMap((b) => {
      const s = shops.get(b.seller_id)
      return s ? [bookingReminderEmail(b, s as never, bookingSettingsOf(s as never), kind)] : []
    })
    await container.resolve(Modules.NOTIFICATION).createNotifications(
      mails.map((m) => ({ to: m.to, channel: "email", template: "aquenora-booking-reminder", data: { subject: m.subject, text: m.text, html: m.html, reply_to: supportEmail() } }))
    )
    await markBookingsRemindedWorkflow(container).run({ input: { ids: due.map((b) => b.id), kind } })
    sent[kind] = due.length
  }
  return sent
}
