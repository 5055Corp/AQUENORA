// What happens when a customer books, pays, changes, cancels or tips, and what the provider can do.
// Called from workflows (workflows/bookings.ts) and the Paystack webhook. See lib/bookings.ts for the rules.

import { randomBytes } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { supportEmail } from "./account-email"
import {
  blocksTime, bookingConfirmedEmail, bookingSettingsOf, bookingToken, bookingUpdateEmail, canChange, customerView, depositFor, feeOn,
  formatWhen, freeSlots, localDate, owedOf, payChoices, sellerBookingEmail, serviceView, teamFor, withAddons,
  type BookingRow, type BookingSettings, type PayChoice, type ServiceRow, type Staff,
} from "./bookings"
import { paymentsBlocker } from "./checkout"
import { money } from "./order-email"
import { initializeTransaction, newBookingReference, PAYSTACK_CURRENCY, paystackEnabled, toSubunit, verifyTransaction } from "./paystack"
import { pushToSeller } from "./push"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

export type BookingSeller = {
  id: string
  name: string
  handle: string
  email: string
  country_code: string
  currency_code: string
  paystack_subaccount_code: string | null
  verification_status: string | null
  suspended_at: Date | string | null
  booking_settings: unknown
  booking_email: { subject: string; message: string } | null
}

const sellersOf = (c: MedusaContainer) => c.resolve<SellerModuleService>(SELLER_MODULE)
const round2 = (n: number) => Math.round(n * 100) / 100

export async function feePercent(c: MedusaContainer): Promise<number> {
  return (await c.resolve<BillingModuleService>(BILLING_MODULE).getSettings()).booking_fee_percent
}

/** The provider by web address, if they take bookings (else "not found"). */
export async function bookingSeller(c: MedusaContainer, handle: string): Promise<{ seller: BookingSeller; settings: BookingSettings }> {
  const [seller] = (await sellersOf(c).listSellers({ handle: handle.toLowerCase() }, { take: 1 })) as unknown as BookingSeller[]
  const settings = seller ? bookingSettingsOf(seller) : null
  if (!seller || seller.suspended_at || !settings?.enabled) throw new MedusaError(MedusaError.Types.NOT_FOUND, "This shop doesn't take bookings.")
  return { seller, settings }
}

/** Can this provider take money online right now? */
export const takesPayments = (s: BookingSeller) => paystackEnabled() && !paymentsBlocker(s as never)

async function busyFor(c: MedusaContainer, sellerId: string, around: Date, exceptId?: string) {
  const from = new Date(around.getTime() - 2 * 86400000)
  const to = new Date(around.getTime() + 2 * 86400000)
  const rows = (await sellersOf(c).listBookings({ seller_id: sellerId, starts_at: { $gte: from, $lte: to }, status: ["pending", "confirmed", "completed"] } as never, { take: 500 })) as unknown as BookingRow[]
  return rows.filter((b) => b.id !== exceptId)
}

const CONTACT_ONLY = "Please contact the shop to book this."

/** Bookings that take a team member's time: theirs, plus any not given to anyone. */
const busyOf = (rows: BookingRow[], staff: Staff | null) => (staff ? rows.filter((b) => !b.staff_id || b.staff_id === staff.id) : rows)

/**
 * Free start times on a day, and who is free at each. One-person business: everyone is `null`.
 * With a team: for one member (staffId), or anyone who does the service.
 */
async function freeByStaff(c: MedusaContainer, seller: BookingSeller, settings: BookingSettings, svc: { id: string; duration_min: number }, date: string, staffId?: string | null, exceptId?: string) {
  const team = teamFor(settings, svc.id)
  const people: (Staff | null)[] = !team.length ? [null] : staffId ? team.filter((m) => m.id === staffId) : team
  if (team.length && staffId && !people.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "That person doesn't do this service. Please choose someone else.")
  const noon = new Date(`${date}T12:00:00Z`)
  if (Number.isNaN(noon.getTime())) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Pick a day.")
  const rows = (await busyFor(c, seller.id, noon, exceptId)) as BookingRow[]
  const who = new Map<string, Staff | null>()
  for (const m of people) {
    for (const t of freeSlots({ settings, duration_min: svc.duration_min, date, busy: busyOf(rows, m), staff: m })) if (!who.has(t)) who.set(t, m)
  }
  return who
}

/** Free start times for a service (with add-ons, which make it longer). */
export async function slotsFor(c: MedusaContainer, handle: string, serviceId: string, date: string, addonIds: string[] = [], staffId?: string | null) {
  const { seller, settings } = await bookingSeller(c, handle)
  const svc = await activeService(c, seller.id, serviceId)
  if (svc.payment === "contact") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, CONTACT_ONLY)
  const free = await freeByStaff(c, seller, settings, { id: svc.id, duration_min: withAddons(svc, addonIds).duration_min }, date, staffId)
  return [...free.keys()].sort()
}

async function activeService(c: MedusaContainer, sellerId: string, id: string): Promise<ServiceRow> {
  const [svc] = (await sellersOf(c).listBookingServices({ id, seller_id: sellerId, active: true }, { take: 1 })) as unknown as ServiceRow[]
  if (!svc) throw new MedusaError(MedusaError.Types.NOT_FOUND, "That service isn't available.")
  return svc
}

/** The public booking page: services, how to pay and the shop's details. */
export async function bookingPage(c: MedusaContainer, handle: string) {
  const { seller, settings } = await bookingSeller(c, handle)
  const services = (await sellersOf(c).listBookingServices({ seller_id: seller.id, active: true }, { order: { sort: "ASC", created_at: "ASC" }, take: 100 })) as unknown as ServiceRow[]
  const online = takesPayments(seller)
  return {
    shop: {
      name: seller.name, handle: seller.handle, address: settings.address, timezone: settings.timezone, cancel_hours: settings.cancel_hours, days_ahead: settings.days_ahead, currency_code: seller.currency_code,
      // How to reach the shop for "Contact to book" services.
      phone: settings.phone || null, email: settings.contact_email || null,
    },
    fee_percent: await feePercent(c),
    // Who customers can choose (salons with a team). Empty for a one-person business.
    staff: (settings.staff ?? []).filter((m) => m.active).map((m) => ({ id: m.id, name: m.name, title: m.title ?? null, service_ids: m.service_ids })),
    services: services.map((s) => ({ ...serviceView(s), pay_choices: payChoices(s, online) })).filter((s) => s.payment === "contact" || s.pay_choices.length),
  }
}

// ---------------- emails and notifications ----------------

type Mail = { to: string; subject: string; text: string; html: string }

async function send(c: MedusaContainer, mails: Mail[], template: string) {
  if (!mails.length) return
  try {
    await c.resolve(Modules.NOTIFICATION).createNotifications(
      mails.map((m) => ({ to: m.to, channel: "email", template, data: { subject: m.subject, text: m.text, html: m.html, reply_to: supportEmail() } }))
    )
  } catch (e) {
    c.resolve(ContainerRegistrationKeys.LOGGER).warn(`Booking email not sent: ${(e as Error).message}`)
  }
}

async function announceConfirmed(c: MedusaContainer, b: BookingRow, seller: BookingSeller, settings: BookingSettings) {
  await send(c, [bookingConfirmedEmail(b, seller, settings, seller.booking_email), sellerBookingEmail(seller.email, b, seller, settings, "new")], "aquenora-booking")
  const when = formatWhen(new Date(b.starts_at), settings.timezone)
  await pushToSeller(c, seller.id, { title: `New booking: ${b.service_name}`, body: `${b.customer_name}, ${when.date} at ${when.time}`, tab: "bookings" })
}

// ---------------- booking ----------------

/** Adds the customer to the shop's list; only a "yes" subscribes them to emails (never un-subscribes). */
async function rememberCustomer(c: MedusaContainer, sellerId: string, email: string, name: string, optIn: boolean) {
  const marketing = c.resolve<MarketingModuleService>(MARKETING_MODULE)
  const [existing] = await marketing.listMarketingContacts({ seller_id: sellerId, email }, { take: 1 })
  if (!existing) {
    await marketing.createMarketingContacts({ seller_id: sellerId, email, name, subscribed: optIn, consented_at: optIn ? new Date() : null, unsubscribe_token: randomBytes(24).toString("base64url") })
  } else if (optIn && !existing.subscribed) {
    await marketing.updateMarketingContacts({ id: existing.id, subscribed: true, consented_at: new Date(), unsubscribed_at: null })
  }
}

export type StartBookingInput = {
  service_id: string
  starts_at: string
  name: string
  email: string
  phone: string
  note?: string
  pay: PayChoice
  return_url: string
  marketing_opt_in?: boolean
  /** Add-ons the customer chose (more money and time). */
  addon_ids?: string[]
  /** A chosen team member; empty for "anyone available". */
  staff_id?: string | null
}

/** Creates the booking. Paying online: a Paystack page for the deposit or full price + AQUENORA's fee. */
export async function startBooking(c: MedusaContainer, handle: string, input: StartBookingInput) {
  const { seller, settings } = await bookingSeller(c, handle)
  const base = await activeService(c, seller.id, input.service_id)
  if (base.payment === "contact") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, CONTACT_ONLY)
  const svc = withAddons(base, input.addon_ids)
  const online = takesPayments(seller)
  if (!payChoices(svc, online).includes(input.pay)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, online ? "Choose how you'd like to pay." : "This shop can't take bookings online right now. Please contact them.")
  }
  const start = new Date(input.starts_at)
  if (Number.isNaN(start.getTime())) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Pick a time.")

  const sellers = sellersOf(c)
  const locking = c.resolve(Modules.LOCKING)
  return locking.execute(`booking:${seller.id}`, async () => {
    const free = await freeByStaff(c, seller, settings, svc, localDate(start, settings.timezone), input.staff_id)
    if (!free.has(start.toISOString())) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Sorry, that time was just taken. Please pick another.")
    const staff = free.get(start.toISOString()) ?? null

    const price = Number(svc.price)
    const payNow = input.pay === "full" ? price : input.pay === "deposit" ? depositFor(svc) : 0
    const booking = (await sellers.createBookings({
      seller_id: seller.id,
      service_id: svc.id,
      service_name: svc.name,
      staff_id: staff?.id ?? null,
      staff_name: staff?.name ?? null,
      addons: svc.chosen.length ? svc.chosen : null,
      duration_min: svc.duration_min,
      starts_at: start,
      ends_at: new Date(start.getTime() + svc.duration_min * 60000),
      status: payNow > 0 ? "pending" : "confirmed",
      customer_name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      note: input.note?.trim() || null,
      currency_code: seller.currency_code,
      price,
      deposit: depositFor(svc),
      paid: 0,
      tips: 0,
      refund_due: 0,
    } as never)) as unknown as BookingRow

    await rememberCustomer(c, seller.id, booking.email, booking.customer_name, !!input.marketing_opt_in)
    if (payNow === 0) {
      await announceConfirmed(c, booking, seller, settings)
      return { booking: customerView(booking, seller, settings), token: bookingToken(booking.id), payment_url: null as string | null }
    }
    const payment_url = await startPayment(c, seller, booking, "booking", payNow, input.return_url)
    return { booking: customerView(booking, seller, settings), token: bookingToken(booking.id), payment_url }
  }, { timeout: 30 })
}

/** A Paystack page for one booking payment. AQUENORA's fee is added on top (none for tips). */
async function startPayment(c: MedusaContainer, seller: BookingSeller, b: BookingRow, kind: "booking" | "balance" | "tip", amount: number, returnUrl: string) {
  const currency = PAYSTACK_CURRENCY[seller.country_code]
  if (!currency || !seller.paystack_subaccount_code) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This shop can't take payments online right now.")
  const fee = kind === "tip" ? 0 : feeOn(amount, await feePercent(c))
  const total = round2(amount + fee)
  const reference = newBookingReference()
  await sellersOf(c).createBookingPayments({ reference, booking_id: b.id, seller_id: seller.id, kind, currency_code: seller.currency_code, amount, fee, total } as never)
  const back = new URL(returnUrl)
  back.searchParams.set("booking", bookingToken(b.id))
  back.searchParams.set("reference", reference)
  const page = await initializeTransaction({
    email: b.email,
    amount: toSubunit(total),
    currency,
    reference,
    callback_url: back.toString(),
    subaccount: seller.paystack_subaccount_code,
    transaction_charge: toSubunit(fee),
    // Bookings: AQUENORA's fee is on top, and AQUENORA pays Paystack's fee from it, so the provider
    // gets exactly their price. Tips: AQUENORA takes nothing; Paystack's fee comes out of the tip.
    bearer: kind === "tip" ? "subaccount" : "account",
    metadata: { booking_id: b.id, kind, seller_handle: seller.handle },
  })
  return page.authorization_url
}

/** After Paystack: records the payment once (from the customer's return or the webhook). */
export async function confirmBookingPayment(c: MedusaContainer, reference: string) {
  return c.resolve(Modules.LOCKING).execute(`paystack:${reference}`, async () => {
    const sellers = sellersOf(c)
    const [pay] = (await sellers.listBookingPayments({ reference })) as unknown as { id: string; booking_id: string; seller_id: string; kind: "booking" | "balance" | "tip"; status: string; amount: unknown; total: unknown; currency_code: string }[]
    if (!pay) throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that payment.")
    const b = (await sellers.retrieveBooking(pay.booking_id)) as unknown as BookingRow
    const seller = (await sellers.retrieveSeller(pay.seller_id)) as unknown as BookingSeller
    const settings = bookingSettingsOf(seller)
    if (pay.status === "paid") return { status: "paid" as const, kind: pay.kind, booking: customerView(b, seller, settings), token: bookingToken(b.id) }

    const tx = await verifyTransaction(reference)
    if (tx.status !== "success") {
      const pending = ["ongoing", "pending", "processing", "queued", "abandoned"].includes(tx.status)
      return { status: pending ? ("pending" as const) : ("failed" as const), kind: pay.kind, booking: customerView(b, seller, settings), token: bookingToken(b.id) }
    }
    if (tx.amount !== toSubunit(Number(pay.total)) || tx.currency.toLowerCase() !== pay.currency_code.toLowerCase()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This payment doesn't match the booking. Please contact the shop.")
    }
    await sellers.updateBookingPayments({ id: pay.id, status: "paid" } as never)
    const amount = Number(pay.amount)
    const update: Record<string, unknown> = { id: b.id }
    if (pay.kind === "tip") update.tips = round2(Number(b.tips) + amount)
    else update.paid = round2(Number(b.paid) + amount)
    // Paid after the hold ran out: still theirs (the money is in), even if it now overlaps.
    if (pay.kind === "booking" && b.status === "pending") update.status = "confirmed"
    const after = (await sellers.updateBookings(update as never)) as unknown as BookingRow

    if (pay.kind === "booking") await announceConfirmed(c, after, seller, settings)
    else {
      const what = pay.kind === "tip" ? "tip" : "paid"
      const shown = money(amount, pay.currency_code)
      await send(c, [bookingUpdateEmail(after, seller, settings, what, shown), sellerBookingEmail(seller.email, after, seller, settings, what, shown)], "aquenora-booking")
      await pushToSeller(c, seller.id, pay.kind === "tip"
        ? { title: `${after.customer_name} left you a tip 🎉`, body: `${shown}. All of it is yours.`, tab: "bookings" }
        : { title: `${after.customer_name} paid the rest`, body: `${shown} for ${after.service_name}`, tab: "bookings" })
    }
    return { status: "paid" as const, kind: pay.kind, booking: customerView(after, seller, settings), token: bookingToken(b.id) }
  }, { timeout: 30 })
}

// ---------------- the customer's own link ----------------

async function byId(c: MedusaContainer, id: string) {
  const sellers = sellersOf(c)
  const b = (await sellers.retrieveBooking(id).catch(() => null)) as unknown as BookingRow | null
  if (!b || b.status === "pending") throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that booking.")
  const seller = (await sellers.retrieveSeller(b.seller_id)) as unknown as BookingSeller
  return { b, seller, settings: bookingSettingsOf(seller) }
}

export async function customerBooking(c: MedusaContainer, id: string) {
  const sellers = sellersOf(c)
  const b = (await sellers.retrieveBooking(id).catch(() => null)) as unknown as BookingRow | null
  if (!b) throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that booking.")
  const seller = (await sellers.retrieveSeller(b.seller_id)) as unknown as BookingSeller
  const settings = bookingSettingsOf(seller)
  return { view: customerView(b, seller, settings), booking: b, seller, settings, online: takesPayments(seller), fee_percent: await feePercent(c) }
}

export type CustomerAction =
  | { action: "cancel" }
  | { action: "reschedule"; starts_at: string }
  | { action: "pay_balance"; return_url: string }
  | { action: "tip"; amount: number; return_url: string }

export async function customerAction(c: MedusaContainer, id: string, input: CustomerAction) {
  const { b, seller, settings } = await byId(c, id)
  const sellers = sellersOf(c)

  if (input.action === "pay_balance" || input.action === "tip") {
    if (!takesPayments(seller)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This shop can't take payments online right now.")
    if (input.action === "pay_balance") {
      if (b.status !== "confirmed") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This booking can't be paid now.")
      const owed = owedOf(b)
      if (owed <= 0) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This booking is already paid in full.")
      return { payment_url: await startPayment(c, seller, b, "balance", owed, input.return_url) }
    }
    if (b.status === "cancelled") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This booking was cancelled.")
    return { payment_url: await startPayment(c, seller, b, "tip", round2(input.amount), input.return_url) }
  }

  if (!canChange(b, settings)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `Bookings can only be changed online up to ${settings.cancel_hours} hours before. Please contact ${seller.name}.`)
  }

  if (input.action === "cancel") {
    // Cancelled in time: everything paid comes back (the provider refunds it directly).
    const refund = Number(b.paid)
    const after = (await sellers.updateBookings({ id: b.id, status: "cancelled", cancelled_by: "customer", refund_due: refund } as never)) as unknown as BookingRow
    const note = refund > 0 ? `${seller.name} will refund your ${money(refund, b.currency_code)}.` : ""
    const sellerNote = refund > 0 ? `Please refund ${money(refund, b.currency_code)} to ${b.customer_name}, then mark it as refunded in the app.` : ""
    await send(c, [bookingUpdateEmail(after, seller, settings, "cancelled", note), sellerBookingEmail(seller.email, after, seller, settings, "cancelled", sellerNote)], "aquenora-booking")
    await pushToSeller(c, seller.id, { title: "Booking cancelled", body: `${b.customer_name}, ${b.service_name}${refund > 0 ? `. Refund ${money(refund, b.currency_code)}` : ""}`, tab: "bookings" })
    return { booking: customerView(after, seller, settings) }
  }

  // Reschedule to another free time.
  const start = new Date(input.starts_at)
  if (Number.isNaN(start.getTime())) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Pick a time.")
  return c.resolve(Modules.LOCKING).execute(`booking:${seller.id}`, async () => {
    // Stays with the same team member (if they're still on the team; else anyone free).
    const team = teamFor(settings, b.service_id)
    const keep = b.staff_id && team.some((m) => m.id === b.staff_id) ? b.staff_id : null
    const free = await freeByStaff(c, seller, settings, { id: b.service_id, duration_min: b.duration_min }, localDate(start, settings.timezone), keep, b.id)
    if (!free.has(start.toISOString())) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Sorry, that time isn't free. Please pick another.")
    const staff = free.get(start.toISOString()) ?? null
    const after = (await sellers.updateBookings({
      id: b.id, starts_at: start, ends_at: new Date(start.getTime() + b.duration_min * 60000), ...(team.length ? { staff_id: staff?.id ?? null, staff_name: staff?.name ?? null } : {}), rescheduled: b.rescheduled + 1, reminded_day_at: null, reminded_hour_at: null,
    } as never)) as unknown as BookingRow
    await send(c, [bookingUpdateEmail(after, seller, settings, "rescheduled"), sellerBookingEmail(seller.email, after, seller, settings, "rescheduled")], "aquenora-booking")
    const when = formatWhen(start, settings.timezone)
    await pushToSeller(c, seller.id, { title: "Booking moved", body: `${b.customer_name}: now ${when.date} at ${when.time}`, tab: "bookings" })
    return { booking: customerView(after, seller, settings) }
  }, { timeout: 30 })
}

// ---------------- the provider ----------------

export type SellerAction = { action: "complete" | "no_show" | "refunded" | "cancel"; reason?: string }

export async function sellerAction(c: MedusaContainer, sellerId: string, id: string, input: SellerAction) {
  const sellers = sellersOf(c)
  const b = (await sellers.retrieveBooking(id).catch(() => null)) as unknown as BookingRow | null
  if (!b || b.seller_id !== sellerId || b.status === "pending") throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
  const seller = (await sellers.retrieveSeller(sellerId)) as unknown as BookingSeller
  const settings = bookingSettingsOf(seller)
  const started = new Date(b.starts_at).getTime() <= Date.now()

  if (input.action === "complete" || input.action === "no_show") {
    if (b.status !== "confirmed" && b.status !== "completed" && b.status !== "no_show") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This booking was cancelled.")
    if (!started) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "You can mark this once the appointment time has come.")
    // No-show: the deposit is kept (that's what it's for).
    return sellers.updateBookings({ id: b.id, status: input.action === "complete" ? "completed" : "no_show" } as never) as unknown as BookingRow
  }
  if (input.action === "refunded") {
    if (Number(b.refund_due) <= 0) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "There's nothing to refund on this booking.")
    return sellers.updateBookings({ id: b.id, refunded_at: new Date() } as never) as unknown as BookingRow
  }
  // The provider cancels: the customer gets everything back.
  if (b.status !== "confirmed") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Only upcoming bookings can be cancelled.")
  const refund = Number(b.paid)
  const after = (await sellers.updateBookings({ id: b.id, status: "cancelled", cancelled_by: "seller", refund_due: refund } as never)) as unknown as BookingRow
  const note = [input.reason?.trim() ? `${seller.name}: "${input.reason.trim()}"` : "", refund > 0 ? `${seller.name} will refund your ${money(refund, b.currency_code)}.` : ""].filter(Boolean).join(" ")
  await send(c, [bookingUpdateEmail(after, seller, settings, "cancelled", note)], "aquenora-booking")
  return after
}

/** For the provider's app: bookings in a time range plus simple numbers. */
export async function sellerBookings(c: MedusaContainer, sellerId: string, from: Date, to: Date) {
  const rows = (await sellersOf(c).listBookings({ seller_id: sellerId, starts_at: { $gte: from, $lte: to }, status: ["confirmed", "completed", "no_show", "cancelled"] } as never, { order: { starts_at: "ASC" }, take: 2000 })) as unknown as BookingRow[]
  return rows
}


// ---------------- the provider adds a booking by hand (walk-in, phone, WhatsApp) ----------------

export type ManualBookingInput = { service_id: string; starts_at: string; name: string; phone?: string; email?: string; note?: string; paid?: number; addon_ids?: string[]; price?: number; staff_id?: string | null }

export async function addManualBooking(c: MedusaContainer, sellerId: string, input: ManualBookingInput) {
  const sellers = sellersOf(c)
  const seller = (await sellers.retrieveSeller(sellerId)) as unknown as BookingSeller
  const settings = bookingSettingsOf(seller)
  const [base] = (await sellers.listBookingServices({ id: input.service_id, seller_id: sellerId }, { take: 1 })) as unknown as ServiceRow[]
  if (!base) throw new MedusaError(MedusaError.Types.NOT_FOUND, "That service isn't available.")
  const svc = withAddons(base, input.addon_ids)
  const start = new Date(input.starts_at)
  if (Number.isNaN(start.getTime())) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Pick a time.")
  const end = new Date(start.getTime() + svc.duration_min * 60000)
  const staff = input.staff_id ? (settings.staff ?? []).find((m) => m.id === input.staff_id) ?? null : null
  if (input.staff_id && !staff) throw new MedusaError(MedusaError.Types.INVALID_DATA, "That team member isn't on your team any more.")
  // The provider can book outside opening hours (it's their diary), but not on top of another booking
  // (for a team member: one of theirs, or one not given to anyone).
  const clash = busyOf((await busyFor(c, sellerId, start)) as BookingRow[], staff).find((b) => blocksTime(b, Date.now()) && start < new Date(b.ends_at) && end > new Date(b.starts_at))
  if (clash) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `That time overlaps ${clash.customer_name}'s ${clash.service_name}.`)
  // A price agreed with the customer (e.g. a bridal quote) replaces the list price.
  const price = input.price ?? Number(svc.price)
  const booking = (await sellers.createBookings({
    seller_id: sellerId, service_id: svc.id, service_name: svc.name, staff_id: staff?.id ?? null, staff_name: staff?.name ?? null, addons: svc.chosen.length ? svc.chosen : null, duration_min: svc.duration_min, starts_at: start, ends_at: end,
    status: "confirmed", customer_name: input.name.trim(), email: (input.email ?? "").trim().toLowerCase(), phone: (input.phone ?? "").trim(),
    note: input.note?.trim() || null, currency_code: seller.currency_code, price, deposit: 0, paid: Math.min(price, Math.max(0, input.paid ?? 0)), tips: 0, refund_due: 0,
  } as never)) as unknown as BookingRow
  // With an email, the customer gets the confirmation (and reminders) like an online booking.
  if (booking.email) await send(c, [bookingConfirmedEmail(booking, seller, settings, seller.booking_email)], "aquenora-booking")
  return booking
}
