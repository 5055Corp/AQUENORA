// Bookings for service providers (hair, makeup, barbers, tailors, photographers...).
//
// Money: the customer pays online the deposit or the full price, PLUS AQUENORA's booking fee
// (billing setting booking_fee_percent, default 3%) on top. The provider receives the full amount
// they charge; AQUENORA's fee covers Paystack's fee. Tips go wholly to the provider (no AQUENORA fee).
//
// Times: stored in UTC; opening hours are wall-clock times in the provider's time zone.

import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "@medusajs/framework/zod"
import { publicApiUrl, shopUrl } from "./campaign-email"
import { money } from "./order-email"
import { signingSecret } from "./order-tracking"

// ---------------- settings ----------------

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
export type Day = (typeof DAYS)[number]
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00")
const interval = z.object({ from: hhmm, to: hhmm }).strict().refine((i) => i.from < i.to, "Opening time must be before closing time")

export const BookingSettingsSchema = z
  .object({
    enabled: z.boolean(),
    timezone: z.string().max(60).refine((tz) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: tz })
        return true
      } catch {
        return false
      }
    }, "Unknown time zone"),
    address: z.string().trim().max(300),
    hours: z.object(Object.fromEntries(DAYS.map((d) => [d, z.array(interval).max(4)])) as Record<Day, z.ZodArray<typeof interval>>).strict(),
    /** Minutes kept free after each appointment. */
    buffer_min: z.number().int().min(0).max(240),
    /** How soon customers can book (minutes from now). */
    min_notice_min: z.number().int().min(0).max(10080),
    /** How far ahead customers can book (days). */
    days_ahead: z.number().int().min(1).max(365),
    /** Free changes and refunds up to this many hours before. */
    cancel_hours: z.number().int().min(0).max(168),
  })
  .strict()
export type BookingSettings = z.infer<typeof BookingSettingsSchema> & { calendar_key?: string }

const TIMEZONE: Record<string, string> = { NG: "Africa/Lagos", GH: "Africa/Accra", ZA: "Africa/Johannesburg", CI: "Africa/Abidjan", SN: "Africa/Dakar", DI: "Europe/London" }

export function defaultBookingSettings(country: string): BookingSettings {
  const day = [{ from: "09:00", to: "18:00" }]
  return {
    enabled: false,
    timezone: TIMEZONE[country] ?? "Africa/Lagos",
    address: "",
    hours: { sun: [], mon: day, tue: day, wed: day, thu: day, fri: day, sat: [{ from: "10:00", to: "16:00" }] },
    buffer_min: 15,
    min_notice_min: 120,
    days_ahead: 60,
    cancel_hours: 24,
  }
}

export function bookingSettingsOf(seller: { booking_settings?: unknown; country_code: string }): BookingSettings {
  const base = defaultBookingSettings(seller.country_code)
  const saved = (seller.booking_settings ?? {}) as Partial<BookingSettings>
  return { ...base, ...saved, hours: { ...base.hours, ...(saved.hours ?? {}) } }
}

// ---------------- time zones ----------------

function partsIn(ms: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value])
  )
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, wd: String(p.weekday).toLowerCase().slice(0, 3) as Day }
}

const offsetAt = (ms: number, tz: string) => {
  const p = partsIn(ms, tz)
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000
}

/** "2026-11-28" + "11:30" in Africa/Lagos → the UTC instant. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const guess = Date.UTC(y, m - 1, d, h, mi)
  let t = guess - offsetAt(guess, tz)
  t = guess - offsetAt(t, tz)
  return new Date(t)
}

/** The provider's local date ("2026-11-28") of an instant. */
export function localDate(at: Date, tz: string): string {
  const p = partsIn(at.getTime(), tz)
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`
}

export function formatWhen(at: Date, tz: string) {
  const date = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(at)
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at)
  return { date, time }
}

// ---------------- free times ----------------

export type BusyBooking = { starts_at: Date | string; ends_at: Date | string; status: string; created_at?: Date | string }
/** A booking waiting for payment holds its time for this long. */
export const HOLD_MS = 30 * 60 * 1000

export const blocksTime = (b: BusyBooking, now: number) =>
  b.status === "confirmed" || b.status === "completed" || (b.status === "pending" && now - new Date(b.created_at ?? 0).getTime() < HOLD_MS)

/** Start times (UTC ISO) a service can be booked on a local date. */
export function freeSlots(input: { settings: BookingSettings; duration_min: number; date: string; busy: BusyBooking[]; now?: number }): string[] {
  const { settings: s, duration_min, date } = input
  const now = input.now ?? Date.now()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
  const noon = zonedToUtc(date, "12:00", s.timezone)
  const day = partsIn(noon.getTime(), s.timezone).wd
  const step = (duration_min <= 30 ? 15 : 30) * 60000
  const dur = duration_min * 60000
  const buffer = s.buffer_min * 60000
  const earliest = now + s.min_notice_min * 60000
  const latest = now + s.days_ahead * 86400000
  const taken = input.busy.filter((b) => blocksTime(b, now)).map((b) => [new Date(b.starts_at).getTime(), new Date(b.ends_at).getTime() + buffer])
  const out: string[] = []
  for (const iv of s.hours[day] ?? []) {
    const open = zonedToUtc(date, iv.from, s.timezone).getTime()
    const close = zonedToUtc(date, iv.to, s.timezone).getTime()
    for (let t = open; t + dur <= close; t += step) {
      if (t < earliest || t > latest) continue
      const end = t + dur + buffer
      if (taken.some(([a, b]) => t < b && end > a)) continue
      out.push(new Date(t).toISOString())
    }
  }
  return out
}

// ---------------- money ----------------

export type ServiceRow = {
  id: string
  seller_id: string
  name: string
  description: string | null
  duration_min: number
  price: unknown
  payment: "deposit" | "full" | "none"
  deposit_type: "fixed" | "percent"
  deposit_value: number
  active: boolean
  sort: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function depositFor(s: Pick<ServiceRow, "price" | "payment" | "deposit_type" | "deposit_value">): number {
  const price = Number(s.price)
  if (s.payment === "full") return price
  if (s.payment === "none") return 0
  const d = s.deposit_type === "percent" ? (price * Number(s.deposit_value)) / 100 : Number(s.deposit_value)
  return round2(Math.min(price, Math.max(0, d)))
}

export type PayChoice = "deposit" | "full" | "later"

/** Which ways a customer can pay for a service when booking. */
export function payChoices(s: ServiceRow, online: boolean): PayChoice[] {
  if (!online) return s.payment === "none" ? ["later"] : []
  if (s.payment === "full") return ["full"]
  if (s.payment === "deposit") return depositFor(s) > 0 && depositFor(s) < Number(s.price) ? ["deposit", "full"] : ["full"]
  return ["later", "full"]
}

/** AQUENORA's fee on top of an online payment to the provider. */
export const feeOn = (amount: number, percent: number) => round2((amount * percent) / 100)

// ---------------- links ----------------

const sign = (id: string) => createHmac("sha256", signingSecret()).update(`booking:${id}`).digest("base64url").slice(0, 24)
export const bookingToken = (id: string) => `${id}.${sign(id)}`
export function bookingIdFromToken(token: string): string | null {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const id = token.slice(0, dot)
  const a = Buffer.from(token.slice(dot + 1))
  const b = Buffer.from(sign(id))
  return a.length === b.length && timingSafeEqual(a, b) ? id : null
}

/** The customer's page for their booking (change, cancel, pay the rest, tip). */
export function manageUrl(handle: string, bookingId: string): string | null {
  const shop = shopUrl(handle)
  return shop ? `${shop}${shop.includes("?") ? "&" : "?"}booking=${encodeURIComponent(bookingToken(bookingId))}` : null
}
export const calendarFileUrl = (bookingId: string) => `${publicApiUrl()}/bookings/${encodeURIComponent(bookingToken(bookingId))}/calendar.ics`
export const sellerCalendarUrl = (key: string) => `${publicApiUrl()}/bookings-calendar/${key}.ics`

// ---------------- what the customer and provider see ----------------

export type BookingRow = {
  id: string
  seller_id: string
  service_id: string
  service_name: string
  duration_min: number
  starts_at: Date | string
  ends_at: Date | string
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show"
  customer_name: string
  email: string
  phone: string
  note: string | null
  currency_code: string
  price: unknown
  deposit: unknown
  paid: unknown
  tips: unknown
  refund_due: unknown
  refunded_at: Date | string | null
  cancelled_by: "customer" | "seller" | null
  rescheduled: number
  created_at?: Date | string
}

export const owedOf = (b: BookingRow) => Math.max(0, round2(Number(b.price) - Number(b.paid)))

export function canChange(b: BookingRow, s: BookingSettings, now = Date.now()) {
  return b.status === "confirmed" && new Date(b.starts_at).getTime() - now >= s.cancel_hours * 3600000
}

/** The customer's view (from their private link): no other customers' details. */
export function customerView(b: BookingRow, shop: { name: string; handle: string }, s: BookingSettings, now = Date.now()) {
  return {
    id: b.id,
    service_name: b.service_name,
    duration_min: b.duration_min,
    starts_at: new Date(b.starts_at).toISOString(),
    ends_at: new Date(b.ends_at).toISOString(),
    status: b.status,
    customer_name: b.customer_name,
    currency_code: b.currency_code,
    price: Number(b.price),
    paid: Number(b.paid),
    owed: owedOf(b),
    tips: Number(b.tips),
    refund_due: Number(b.refund_due),
    refunded: !!b.refunded_at,
    can_change: canChange(b, s, now),
    cancel_hours: s.cancel_hours,
    timezone: s.timezone,
    shop: { name: shop.name, handle: shop.handle, address: s.address },
  }
}

/** The provider's view. */
export function sellerView(b: BookingRow) {
  return {
    id: b.id,
    service_id: b.service_id,
    service_name: b.service_name,
    duration_min: b.duration_min,
    starts_at: new Date(b.starts_at).toISOString(),
    ends_at: new Date(b.ends_at).toISOString(),
    status: b.status,
    customer_name: b.customer_name,
    email: b.email,
    phone: b.phone,
    note: b.note,
    currency_code: b.currency_code,
    price: Number(b.price),
    deposit: Number(b.deposit),
    paid: Number(b.paid),
    owed: owedOf(b),
    tips: Number(b.tips),
    refund_due: Number(b.refund_due),
    refunded_at: b.refunded_at ? new Date(b.refunded_at).toISOString() : null,
    cancelled_by: b.cancelled_by,
    created_at: b.created_at ? new Date(b.created_at).toISOString() : null,
  }
}

export function serviceView(s: ServiceRow) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    duration_min: s.duration_min,
    price: Number(s.price),
    payment: s.payment,
    deposit_type: s.deposit_type,
    deposit_value: Number(s.deposit_value),
    deposit: depositFor(s),
    active: s.active,
    sort: s.sort,
  }
}

// ---------------- calendar files (.ics) ----------------

const icsDate = (d: Date | string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

export function icsEvent(e: { uid: string; start: Date | string; end: Date | string; title: string; location?: string; description?: string; cancelled?: boolean }) {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}@aquenora.com`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(e.start)}`,
    `DTEND:${icsDate(e.end)}`,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${icsText(e.description)}`] : []),
    ...(e.cancelled ? ["STATUS:CANCELLED"] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(e.title)}`,
    "END:VALARM",
    "END:VEVENT",
  ]
}

export const icsCalendar = (name: string, events: string[][]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AQUENORA//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsText(name)}`, ...events.flat(), "END:VCALENDAR"].join("\r\n") + "\r\n"

// ---------------- emails ----------------

export const DEFAULT_BOOKING_EMAIL = {
  subject: "Your appointment with {shop} is booked",
  message: "Hi {customer},\n\nThank you for booking {service} with {shop}. We're looking forward to seeing you on {date} at {time}.\n\nIf anything changes, you can change or cancel your booking with the link below.",
}
export const BOOKING_EMAIL_PLACEHOLDERS = ["customer", "service", "shop", "date", "time", "location", "total", "paid", "owed"] as const

export const BookingEmailSchema = z
  .object({ subject: z.string().trim().min(1, "Add a subject").max(150), message: z.string().trim().min(1, "Write a message").max(3000) })
  .strict()

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (all, k: string) => (k in values ? values[k] : all))

type EmailShop = { name: string; handle: string }

function details(b: BookingRow, s: BookingSettings) {
  const when = formatWhen(new Date(b.starts_at), s.timezone)
  const end = formatWhen(new Date(b.ends_at), s.timezone)
  const owed = owedOf(b)
  return {
    when,
    values: {
      customer: b.customer_name.split(/\s+/)[0] || "there",
      service: b.service_name,
      date: when.date,
      time: when.time,
      location: s.address || "the shop",
      total: money(Number(b.price), b.currency_code),
      paid: money(Number(b.paid), b.currency_code),
      owed: money(owed, b.currency_code),
    },
    rows: [
      ["What", b.service_name],
      ["When", `${when.date}, ${when.time} – ${end.time}`],
      ...(s.address ? [["Where", s.address]] : []),
      ["Total", money(Number(b.price), b.currency_code)],
      ["Paid online", Number(b.paid) > 0 ? money(Number(b.paid), b.currency_code) : "Nothing yet"],
      ["To pay at the appointment", owed > 0 ? money(owed, b.currency_code) : "Nothing. All paid ✓"],
    ] as [string, string][],
  }
}

function wrap(shop: EmailShop, title: string, intro: string, rows: [string, string][], buttons: { href: string; label: string }[], foot: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;"><div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:18px;text-align:center;"><div style="font-weight:800;font-size:18px;">${esc(shop.name)}</div><div style="font-size:11px;letter-spacing:3px;color:#cdbcf2;margin-top:3px;">ON AQUENORA</div></div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:22px;">
<h1 style="font-size:21px;margin:0 0 10px;">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.55;margin:0 0 16px;">${esc(intro).replace(/\n/g, "<br>")}</div>
<table style="width:100%;border-collapse:collapse;font-size:14.5px;margin:0 0 16px;background:#f7f2ea;border-radius:12px;">${rows
    .map(([k, v]) => `<tr><td style="padding:8px 12px;color:#6b645a;white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:8px 12px;font-weight:700;">${esc(v)}</td></tr>`)
    .join("")}</table>
${buttons.map((b, i) => `<p style="text-align:center;margin:0 0 10px;"><a href="${esc(b.href)}" style="display:inline-block;background:${i === 0 ? "#5B21B6" : "#ffffff"};color:${i === 0 ? "#fff" : "#5B21B6"};border:2px solid #5B21B6;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px;">${esc(b.label)}</a></p>`).join("")}
<p style="font-size:12.5px;color:#6b645a;margin:14px 0 0;line-height:1.5;">${esc(foot)}</p>
</div></div></body></html>`
}

function text(intro: string, rows: [string, string][], links: { href: string; label: string }[], foot: string) {
  return `${intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${links.map((l) => `${l.label}: ${l.href}`).join("\n")}\n\n${foot}\n\nAQUENORA`
}

/** "Appointment booked", in the provider's own words (subject and message), with the details always included. */
export function bookingConfirmedEmail(b: BookingRow, shop: EmailShop, s: BookingSettings, template?: { subject: string; message: string } | null) {
  const t = template ?? DEFAULT_BOOKING_EMAIL
  const d = details(b, s)
  const subject = fill(t.subject, d.values).slice(0, 200)
  const intro = fill(t.message, d.values)
  const links = [
    ...(manageUrl(shop.handle, b.id) ? [{ href: manageUrl(shop.handle, b.id)!, label: owedOf(b) > 0 ? "See, change or pay the rest" : "See or change my booking" }] : []),
    { href: calendarFileUrl(b.id), label: "Add to my calendar" },
  ]
  const foot = `Free changes and cancellations up to ${s.cancel_hours} hours before. We'll remind you the day before and 2 hours before.`
  return { to: b.email, subject, text: text(intro, d.rows, links, foot), html: wrap(shop, subject, intro, d.rows, links, foot) }
}

export function bookingReminderEmail(b: BookingRow, shop: EmailShop, s: BookingSettings, kind: "day" | "hour") {
  const d = details(b, s)
  const subject = kind === "day" ? `Reminder: ${b.service_name} with ${shop.name} tomorrow at ${d.when.time}` : `See you soon: ${b.service_name} at ${d.when.time}`
  const intro =
    kind === "day"
      ? `Hi ${d.values.customer}, a reminder that your ${b.service_name} with ${shop.name} is tomorrow, ${d.when.date} at ${d.when.time}.`
      : `Hi ${d.values.customer}, your ${b.service_name} with ${shop.name} is in about 2 hours (${d.when.time}).`
  const link = manageUrl(shop.handle, b.id)
  const links = link ? [{ href: link, label: owedOf(b) > 0 ? "Pay the rest now, or change it" : "See or change my booking" }] : []
  const foot = canChange(b, s) ? `Can't make it? Change or cancel for free up to ${s.cancel_hours} hours before.` : "Running late or can't make it? Please let the shop know."
  return { to: b.email, subject, text: text(intro, d.rows, links, foot), html: wrap(shop, subject, intro, d.rows, links, foot) }
}

/** To the customer: changed, cancelled, payment received or tip received. */
export function bookingUpdateEmail(b: BookingRow, shop: EmailShop, s: BookingSettings, what: "rescheduled" | "cancelled" | "paid" | "tip", extra = "") {
  const d = details(b, s)
  const first = d.values.customer
  const subjects = {
    rescheduled: `Booking changed: ${b.service_name} on ${d.when.date} at ${d.when.time}`,
    cancelled: `Booking cancelled: ${b.service_name} with ${shop.name}`,
    paid: `Payment received: ${b.service_name} with ${shop.name}`,
    tip: `Thank you for your tip to ${shop.name}`,
  }
  const intros = {
    rescheduled: `Hi ${first}, your booking is now on ${d.when.date} at ${d.when.time}.`,
    cancelled: `Hi ${first}, your ${b.service_name} with ${shop.name} on ${d.when.date} at ${d.when.time} is cancelled.${extra ? ` ${extra}` : ""}`,
    paid: `Hi ${first}, thank you! We've received your payment.`,
    tip: `Hi ${first}, thank you for your tip${extra ? ` of ${extra}` : ""}. All of it goes to ${shop.name}.`,
  }
  const link = what === "cancelled" ? null : manageUrl(shop.handle, b.id)
  const links = [...(link ? [{ href: link, label: "See my booking" }] : []), ...(what === "rescheduled" ? [{ href: calendarFileUrl(b.id), label: "Add to my calendar" }] : [])]
  const foot = "Questions? Reply to this email."
  return { to: b.email, subject: subjects[what], text: text(intros[what], d.rows, links, foot), html: wrap(shop, subjects[what], intros[what], d.rows, links, foot) }
}

/** To the provider: a new booking, a change, a cancellation or money received. */
export function sellerBookingEmail(to: string, b: BookingRow, shop: EmailShop, s: BookingSettings, what: "new" | "rescheduled" | "cancelled" | "paid" | "tip", extra = "") {
  const d = details(b, s)
  const subjects = {
    new: `New booking: ${b.service_name}, ${d.when.date} at ${d.when.time}`,
    rescheduled: `Booking moved: ${b.customer_name} is now ${d.when.date} at ${d.when.time}`,
    cancelled: `Booking cancelled: ${b.customer_name}, ${d.when.date} at ${d.when.time}`,
    paid: `${b.customer_name} paid the rest for ${b.service_name}`,
    tip: `${b.customer_name} left you a tip${extra ? ` of ${extra}` : ""} 🎉`,
  }
  const intro = {
    new: `${b.customer_name} booked ${b.service_name}.${b.note ? `\n\nTheir note: "${b.note}"` : ""}`,
    rescheduled: `${b.customer_name} moved their ${b.service_name}.`,
    cancelled: `${b.customer_name}'s ${b.service_name} is cancelled.${extra ? ` ${extra}` : ""}`,
    paid: `${b.customer_name} paid the rest online. It's on its way to your bank account.`,
    tip: `All of it goes to you: AQUENORA takes nothing from tips.`,
  }[what]
  const rows: [string, string][] = [...d.rows, ["Customer", `${b.customer_name} · ${b.phone} · ${b.email}`]]
  const foot = "Open the AQUENORA app → Bookings to see your day."
  return { to, subject: subjects[what], text: text(intro, rows, [], foot), html: wrap(shop, subjects[what], intro, rows, [], foot) }
}
