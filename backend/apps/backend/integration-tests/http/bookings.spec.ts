import http from "node:http"
import crypto from "node:crypto"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { sendBookingReminders } from "../../src/lib/booking-reminders"

jest.setTimeout(120 * 1000)
const password = "supersecret123"
const SECRET = "sk_test_fake"

// ---- a fake Paystack API ----
type Tx = { reference: string; amount: number; currency: string; body: Record<string, unknown>; status: string; fees: number }
const paystack = {
  transactions: new Map<string, Tx>(),
  subaccounts: [] as Record<string, unknown>[],
  verifyCalls: 0,
}
const server = http.createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => {
    const send = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(json))
    }
    if (req.headers.authorization !== `Bearer ${SECRET}`) return send(401, { status: false, message: "Invalid key" })
    const url = new URL(req.url!, "http://x")
    const data = body ? JSON.parse(body) : {}
    if (req.method === "GET" && url.pathname === "/bank") {
      return send(200, { status: true, message: "ok", data: [{ name: "Access Bank", code: "044", active: true }, { name: "GTBank", code: "058", active: true }] })
    }
    if (req.method === "GET" && url.pathname === "/bank/resolve") {
      if (url.searchParams.get("account_number") === "0000000000") return send(422, { status: false, message: "Could not resolve account name. Check parameters or try again." })
      return send(200, { status: true, message: "ok", data: { account_name: "ADAEZE OKAFOR" } })
    }
    if (url.pathname.startsWith("/subaccount")) {
      paystack.subaccounts.push({ method: req.method, ...data })
      const code = req.method === "PUT" ? url.pathname.split("/").pop() : "ACCT_" + paystack.subaccounts.length
      return send(200, { status: true, message: "ok", data: { subaccount_code: code, account_name: null } })
    }
    if (req.method === "POST" && url.pathname === "/transaction/initialize") {
      paystack.transactions.set(data.reference, { reference: data.reference, amount: data.amount, currency: data.currency, body: data, status: "success", fees: 52000 })
      return send(200, { status: true, message: "ok", data: { authorization_url: `https://checkout.paystack.test/${data.reference}`, access_code: "x", reference: data.reference } })
    }
    if (req.method === "GET" && url.pathname.startsWith("/transaction/verify/")) {
      paystack.verifyCalls++
      const tx = paystack.transactions.get(decodeURIComponent(url.pathname.split("/").pop()!))
      if (!tx) return send(404, { status: false, message: "Transaction reference not found" })
      return send(200, { status: true, message: "ok", data: { id: 1, status: tx.status, reference: tx.reference, amount: tx.amount, currency: tx.currency, fees: tx.fees, authorization: { country_code: "NG" }, metadata: tx.body.metadata } })
    }
    send(404, { status: false, message: "Not found" })
  })
})

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  process.env.PAYSTACK_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.PAYSTACK_SECRET_KEY = SECRET
  process.env.STORE_DOMAIN = "aquenora.test"
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    type Res = { status: number; data: { message: string } }
    const err = (p: Promise<unknown>): Promise<Res> => p.then(() => ({ status: 200, data: { message: "" } }), (e) => e.response)
    const sellerModule = () => getContainer().resolve("seller") as { updateSellers: (d: unknown) => Promise<unknown>; listSellers: (f: unknown) => Promise<{ id: string }[]> }
    const mails = async (template = "aquenora-booking") =>
      (await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ template })) as unknown as { to: string; data: { subject: string; text: string } }[]

    // Open every day 09:00–18:00 so the test works on any weekday.
    const day = [{ from: "09:00", to: "18:00" }]
    const settings = {
      enabled: true, timezone: "Africa/Lagos", address: "14 Admiralty Way, Lekki", buffer_min: 15, min_notice_min: 60, days_ahead: 60, cancel_hours: 24,
      hours: { sun: day, mon: day, tue: day, wed: day, thu: day, fri: day, sat: day },
    }
    // A day 3 days from now (Lagos date).
    const inDays = (n: number) => new Date(Date.now() + n * 86400000 + 3600000).toISOString().slice(0, 10)

    async function setup() {
      const email = "glow@example.com"
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const { seller: created } = (await api.post("/sellers", { name: "Glow by Ada" }, { headers: { authorization: `Bearer ${reg.data.token}` } })).data
      await sellerModule().updateSellers({ id: created.id, verification_status: "verified" })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const headers = { authorization: `Bearer ${login.data.token}` }
      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      const store = { headers: { "x-publishable-api-key": key.token } }
      return { headers, store, sellerId: created.id as string }
    }
    const customer = (service_id: string, starts_at: string, pay: string) => ({
      service_id, starts_at, pay, name: "Chioma Eze", email: "Chioma@Example.com", phone: "+234 801 234 5678", note: "Soft glam please", return_url: "https://glowbyada.aquenora.test/book",
    })

    it("a customer books with a deposit + 3% on top; the provider gets the full price; pay the rest, tip, change and cancel", async () => {
      const { headers, store } = await setup()
      // Not taking bookings yet.
      expect((await err(api.get("/store/sellers/glowbyada/booking", store))).status).toBe(404)
      await api.post("/sellers/me", { booking_settings: settings, booking_email: { subject: "Booked: {service} at {time}", message: "Hi {customer}! See you at {location}. Total {total}, paid {paid}, owed {owed}." } }, { headers })

      // Services: checked, then added.
      expect((await err(api.post("/sellers/me/services", { name: "Makeup", duration_min: 60, price: 45000, payment: "deposit" }, { headers }))).status).toBe(400)
      const makeup = (await api.post("/sellers/me/services", { name: "Bridal trial makeup", duration_min: 60, price: 45000, payment: "deposit", deposit_type: "fixed", deposit_value: 10000 }, { headers })).data.service
      const lash = (await api.post("/sellers/me/services", { name: "Lash refill", duration_min: 30, price: 8000, payment: "none" }, { headers })).data.service
      expect(makeup).toMatchObject({ deposit: 10000, price: 45000 })

      const page = (await api.get("/store/sellers/glowbyada/booking", store)).data
      expect(page.fee_percent).toBe(3)
      expect(page.shop).toMatchObject({ name: "Glow by Ada", address: "14 Admiralty Way, Lekki" })
      expect(page.services.map((s: { name: string; pay_choices: string[] }) => [s.name, s.pay_choices])).toEqual([["Bridal trial makeup", ["deposit", "full"]], ["Lash refill", ["later", "full"]]])

      const date = inDays(3)
      const slots: string[] = (await api.get(`/store/sellers/glowbyada/booking/slots?service_id=${makeup.id}&date=${date}`, store)).data.slots
      expect(slots.length).toBeGreaterThan(5)

      // Book with the deposit: ₦10,000 to the provider + ₦300 AQUENORA fee on top; AQUENORA pays Paystack's fee.
      const started = (await api.post("/store/sellers/glowbyada/booking", customer(makeup.id, slots[0], "deposit"), store)).data
      expect(started.payment_url).toContain("checkout.paystack.test")
      const ref = new URL(started.payment_url).pathname.slice(1)
      expect(paystack.transactions.get(ref)!.body).toMatchObject({ amount: 1030000, transaction_charge: 30000, bearer: "account", subaccount: "ACCT_1", currency: "NGN" })
      // While they pay, the time is held.
      expect((await api.get(`/store/sellers/glowbyada/booking/slots?service_id=${makeup.id}&date=${date}`, store)).data.slots).not.toContain(slots[0])
      expect((await err(api.post("/store/sellers/glowbyada/booking", customer(makeup.id, slots[0], "deposit"), store))).status).toBe(400)

      const paid = (await api.post("/store/booking-payments/verify", { reference: ref }, store)).data
      expect(paid).toMatchObject({ status: "paid", kind: "booking", booking: { status: "confirmed", price: 45000, paid: 10000, owed: 35000, can_change: true } })
      const token = paid.token
      // The provider's own words, with the details always there; the provider is told too.
      let sent = await mails()
      const mine = sent.find((m) => m.to === "chioma@example.com")!
      expect(mine.data.subject).toMatch(/^Booked: Bridal trial makeup at \d\d:\d\d$/)
      expect(mine.data.text).toContain("Hi Chioma! See you at 14 Admiralty Way, Lekki. Total ₦45,000, paid ₦10,000, owed ₦35,000.")
      expect(mine.data.text).toContain("To pay at the appointment: ₦35,000")
      expect(sent.find((m) => m.to === "glow@example.com")!.data.subject).toContain("New booking: Bridal trial makeup")
      // Paying twice (webhook + return) records it once.
      await api.post("/store/booking-payments/verify", { reference: ref }, store)
      expect((await api.get(`/store/bookings/${token}`, store)).data.booking.paid).toBe(10000)
      expect((await err(api.get(`/store/bookings/${token.slice(0, -2)}xx`, store))).status).toBe(404)

      // Pay the rest online: ₦35,000 + ₦1,050.
      const rest = (await api.post(`/store/bookings/${token}`, { action: "pay_balance", return_url: "https://glowbyada.aquenora.test/" }, store)).data
      const restRef = new URL(rest.payment_url).pathname.slice(1)
      expect(paystack.transactions.get(restRef)!.body).toMatchObject({ amount: 3605000, transaction_charge: 105000, bearer: "account" })
      expect((await api.post("/store/booking-payments/verify", { reference: restRef }, store)).data.booking).toMatchObject({ paid: 45000, owed: 0 })
      expect((await err(api.post(`/store/bookings/${token}`, { action: "pay_balance", return_url: "https://glowbyada.aquenora.test/" }, store))).status).toBe(400)

      // A tip: AQUENORA takes nothing; Paystack's fee comes out of the tip.
      const tip = (await api.post(`/store/bookings/${token}`, { action: "tip", amount: 2000, return_url: "https://glowbyada.aquenora.test/" }, store)).data
      const tipRef = new URL(tip.payment_url).pathname.slice(1)
      expect(paystack.transactions.get(tipRef)!.body).toMatchObject({ amount: 200000, transaction_charge: 0, bearer: "subaccount" })
      expect((await api.post("/store/booking-payments/verify", { reference: tipRef }, store)).data.booking.tips).toBe(2000)

      // Change to another free time, then cancel in time: the provider owes back everything paid.
      const moved = (await api.post(`/store/bookings/${token}`, { action: "reschedule", starts_at: slots[4] }, store)).data.booking
      expect(moved.starts_at).toBe(slots[4])
      expect((await api.get(`/store/sellers/glowbyada/booking/slots?service_id=${makeup.id}&date=${date}`, store)).data.slots).toContain(slots[0])
      const cancelled = (await api.post(`/store/bookings/${token}`, { action: "cancel" }, store)).data.booking
      expect(cancelled).toMatchObject({ status: "cancelled", refund_due: 45000 })
      sent = await mails()
      expect(sent.some((m) => m.to === "glow@example.com" && m.data.text.includes("Please refund ₦45,000"))).toBe(true)

      // Pay-at-the-appointment service: no online payment, confirmed straight away.
      const lashSlots: string[] = (await api.get(`/store/sellers/glowbyada/booking/slots?service_id=${lash.id}&date=${inDays(4)}`, store)).data.slots
      const later = (await api.post("/store/sellers/glowbyada/booking", customer(lash.id, lashSlots[0], "later"), store)).data
      expect(later).toMatchObject({ payment_url: null, booking: { status: "confirmed", paid: 0, owed: 8000 } })
      expect((await err(api.post("/store/sellers/glowbyada/booking", customer(lash.id, lashSlots[1], "deposit"), store))).status).toBe(400)

      // The provider's list, actions and refund marking.
      const mine2 = (await api.get("/sellers/me/bookings", { headers })).data
      expect(mine2.bookings.map((b: { status: string }) => b.status).sort()).toEqual(["cancelled", "confirmed"])
      expect(mine2.stats).toMatchObject({ refunds_due: 1, tips: 0 })
      const c = mine2.bookings.find((b: { status: string }) => b.status === "cancelled")
      await api.post(`/sellers/me/bookings/${c.id}`, { action: "refunded" }, { headers })
      expect((await api.get("/sellers/me/bookings", { headers })).data.stats.refunds_due).toBe(0)
      const upcoming = mine2.bookings.find((b: { status: string }) => b.status === "confirmed")
      expect((await err(api.post(`/sellers/me/bookings/${upcoming.id}`, { action: "no_show" }, { headers }))).status).toBe(400) // not yet
      expect((await api.post(`/sellers/me/bookings/${upcoming.id}`, { action: "cancel", reason: "I'm unwell, so sorry" }, { headers })).data.booking).toMatchObject({ status: "cancelled", cancelled_by: "seller" })
    })

    it("reminders, calendar files, the provider's calendar feed and the spreadsheet (Pro)", async () => {
      const { headers, store, sellerId } = await setup()
      await api.post("/sellers/me", { booking_settings: settings }, { headers })
      const cut = (await api.post("/sellers/me/services", { name: "Haircut", duration_min: 45, price: 6000, payment: "none" }, { headers })).data.service
      const date = inDays(3)
      const slot: string = (await api.get(`/store/sellers/glowbyada/booking/slots?service_id=${cut.id}&date=${date}`, store)).data.slots[2]
      const { token } = (await api.post("/store/sellers/glowbyada/booking", customer(cut.id, slot, "later"), store)).data

      // Calendar file for the customer (no key needed: it's linked from their email).
      const ics = await api.get(`/bookings/${token}/calendar`)
      expect(ics.headers["content-type"]).toContain("text/calendar")
      expect(ics.data).toContain("SUMMARY:Haircut · Glow by Ada")
      expect((await err(api.get(`/bookings/${token.slice(0, -2)}xx/calendar`))).status).toBe(404)

      // The provider's private feed for Google / Apple Calendar; a new link stops the old one.
      const { url } = (await api.post("/sellers/me/booking-calendar", {}, { headers })).data
      const path = new URL(url).pathname
      expect((await api.get(path)).data).toContain("SUMMARY:Chioma Eze: Haircut")
      // Saving settings again keeps the link.
      await api.post("/sellers/me", { booking_settings: settings }, { headers })
      expect((await api.get(path)).status).toBe(200)
      const renewed = (await api.post("/sellers/me/booking-calendar", { renew: true }, { headers })).data.url
      expect((await err(api.get(path))).status).toBe(404)
      expect((await api.get(new URL(renewed).pathname)).status).toBe(200)

      // Reminders: the day before, once; then 2 hours before.
      const start = new Date(slot).getTime()
      // (The booking was just made; pretend it was made a week ago so reminders are due.)
      await (getContainer().resolve("seller") as { updateBookings: (d: unknown) => Promise<unknown> }).updateBookings({ id: token.split(".")[0], created_at: new Date(start - 7 * 86400000) })
      expect(await sendBookingReminders(getContainer(), start - 24 * 3600000)).toEqual({ day: 1, hour: 0 })
      expect(await sendBookingReminders(getContainer(), start - 23 * 3600000)).toEqual({ day: 0, hour: 0 })
      expect(await sendBookingReminders(getContainer(), start - 2 * 3600000)).toEqual({ day: 0, hour: 1 })
      expect((await mails("aquenora-booking-reminder")).map((m) => m.data.subject)).toEqual([expect.stringContaining("Reminder: Haircut with Glow by Ada tomorrow"), expect.stringContaining("See you soon")])

      // A walk-in added by hand: no payment online, a clash is refused, an email gets the confirmation.
      const walkIn = (await api.post("/sellers/me/bookings", { service_id: cut.id, starts_at: new Date(new Date(slot).getTime() + 3 * 3600000).toISOString(), name: "Tunde", phone: "0802", paid: 6000 }, { headers })).data.booking
      expect(walkIn).toMatchObject({ status: "confirmed", paid: 6000, owed: 0, customer_name: "Tunde" })
      expect((await err(api.post("/sellers/me/bookings", { service_id: cut.id, starts_at: slot, name: "Clash" }, { headers }))).data.message).toContain("overlaps Chioma Eze's Haircut")

      // The spreadsheet is part of Pro.
      expect((await err(api.get("/sellers/me/bookings/export", { headers }))).status).toBe(400)
      await sellerModule().updateSellers({ id: sellerId, pro_paid_until: new Date(Date.now() + 30 * 86400000) })
      const csv = await api.get("/sellers/me/bookings/export", { headers })
      expect(csv.headers["content-type"]).toContain("text/csv")
      expect(csv.data).toContain('"Haircut","Chioma Eze"')
    })
    it("shows the store's booking button only with bookings on and a service to book", async () => {
      const { headers, store } = await setup()
      const flag = async () => (await api.get("/store/sellers/glowbyada", store)).data.store.bookings
      expect(await flag()).toBe(false)
      await api.post("/sellers/me", { booking_settings: settings }, { headers })
      expect(await flag()).toBe(false) // nothing to book yet
      const svc = (await api.post("/sellers/me/services", { name: "Lash refill", duration_min: 30, price: 8000, payment: "none" }, { headers })).data.service
      expect(await flag()).toBe(true)
      await api.post(`/sellers/me/services/${svc.id}`, { active: false }, { headers })
      expect(await flag()).toBe(false)
      await api.post(`/sellers/me/services/${svc.id}`, { active: true }, { headers })
      await api.post("/sellers/me", { booking_settings: { ...settings, enabled: false } }, { headers })
      expect(await flag()).toBe(false)
    })
  },
})
