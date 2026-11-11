import http from "node:http"
import crypto from "node:crypto"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { renewDuePro } from "../../src/lib/pro-billing"

jest.setTimeout(120 * 1000)
const password = "supersecret123"
const SECRET = "sk_test_fake_pro"

// Fake Paystack: card payment pages, verification with a reusable card, and saved-card charges.
const tx = new Map<string, Record<string, unknown>>()
const charges: Record<string, unknown>[] = []
let declineCharges = false
let reusableCard = true
const card = (reusable: boolean) => ({
  authorization_code: "AUTH_card1", reusable, channel: "card", last4: "4081", brand: "visa", exp_month: "12", exp_year: "2030", signature: "SIG_1",
})
const server = http.createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => {
    const send = (status: number, json: unknown) => {
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(json))
    }
    const url = new URL(req.url!, "http://x")
    const data = body ? JSON.parse(body) : {}
    if (url.pathname === "/transaction/initialize") {
      tx.set(data.reference, { ...data, status: "success" })
      return send(200, { status: true, message: "ok", data: { authorization_url: `https://paystack.test/${data.reference}`, reference: data.reference } })
    }
    if (url.pathname.startsWith("/transaction/verify/")) {
      const t = tx.get(url.pathname.split("/").pop()!)!
      return send(200, {
        status: true, message: "ok",
        data: { id: 1, status: t.status, reference: t.reference, amount: t.amount, currency: t.currency, fees: 0, customer: { email: t.email }, authorization: card(reusableCard), metadata: t.metadata },
      })
    }
    if (url.pathname === "/transaction/charge_authorization") {
      charges.push(data)
      const status = declineCharges ? "failed" : "success"
      tx.set(data.reference, { ...data, status })
      return send(200, {
        status: true, message: "Charge attempted",
        data: { id: 2, status, reference: data.reference, amount: data.amount, currency: data.currency, fees: 0, customer: { email: data.email }, authorization: card(true), metadata: data.metadata },
      })
    }
    send(404, { status: false, message: "nf" })
  })
})

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  process.env.PAYSTACK_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.PAYSTACK_SECRET_KEY = SECRET
  process.env.SELLER_CORS = "https://app.aquenora.test"
  process.env.EXCHANGE_RATES_URL = ""
  delete process.env.PAYSTACK_ACCOUNT_CURRENCIES
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))
beforeEach(() => {
  declineCharges = false
  reusableCard = true
  charges.length = 0
})

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    type Res = { status: number; data: { message: string } }
    const err = (p: Promise<unknown>): Promise<Res> => p.then(() => ({ status: 200, data: { message: "" } }), (e) => e.response)
    const back = "https://app.aquenora.test/?tab=plan"

    async function signUp(country = "NG", email = "pro@example.com") {
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const created = (await api.post("/sellers", { name: `Shop ${email.split("@")[0]}`, country_code: country }, { headers: { authorization: `Bearer ${reg.data.token}` } })).data.seller
      const login = await api.post("/auth/seller/emailpass", { email, password })
      return { seller: created, headers: { authorization: `Bearer ${login.data.token}` } }
    }
    const plan = async (headers: Record<string, string>) => (await api.get("/sellers/me/plan", { headers })).data

    it("first month by card: Pro on, card saved, renews monthly", async () => {
      const { headers } = await signUp()
      expect((await plan(headers)).billing).toMatchObject({ card_payments: true, charge: { amount: 38500, currency_code: "ngn" }, card: null, auto_renew: false })

      expect((await err(api.post("/sellers/me/plan/upgrade", { return_url: "https://evil.test/" }, { headers }))).status).toBe(400)
      const started = (await api.post("/sellers/me/plan/upgrade", { return_url: back }, { headers })).data
      expect(started).toMatchObject({ amount: 38500, currency_code: "NGN" })
      const sent = tx.get(started.reference)!
      expect(sent).toMatchObject({ amount: 3850000, currency: "NGN", channels: ["card"], email: "pro@example.com" })
      expect(sent.subaccount).toBeUndefined() // all of it goes to AQUENORA
      expect(sent.callback_url).toBe(`${back}&pro_reference=${started.reference}`)

      // Return page and webhook both confirm: Pro is extended only once.
      const a = (await api.post("/sellers/me/plan/confirm", { reference: started.reference }, { headers })).data
      const raw = JSON.stringify({ event: "charge.success", data: { reference: started.reference } })
      const sig = crypto.createHmac("sha512", SECRET).update(raw).digest("hex")
      await api.post("/paystack/webhook", raw, { headers: { "content-type": "application/json", "x-paystack-signature": sig } })
      const after = await plan(headers)
      expect(a.status).toBe("paid")
      expect(after.plan).toMatchObject({ plan: "pro", status: "paid", show_badge: false, commission_percent: 1 })
      const until = new Date(after.plan.pro_paid_until).getTime()
      expect(until).toBeGreaterThan(Date.now() + 27 * 86400000)
      expect(until).toBeLessThan(Date.now() + 32 * 86400000)
      expect(after.billing).toMatchObject({ card: { brand: "visa", last4: "4081" }, auto_renew: true })

      // Not due yet: nothing is charged.
      expect(await renewDuePro(getContainer())).toEqual([])
      // Half a day before the end: the saved card is charged for the next month.
      const soon = new Date(until - 12 * 3600 * 1000)
      const r = await renewDuePro(getContainer(), soon)
      expect(r).toEqual([expect.objectContaining({ status: "paid" })])
      expect(charges[0]).toMatchObject({ authorization_code: "AUTH_card1", amount: 3850000, currency: "NGN", email: "pro@example.com" })
      const renewed = new Date((await plan(headers)).plan.pro_paid_until).getTime()
      expect(renewed - until).toBeGreaterThan(27 * 86400000)
      // Running again right away doesn't charge twice.
      expect(await renewDuePro(getContainer(), soon)).toEqual([])
    })

    it("failed renewals are retried, then stop; Pro ends with the paid month", async () => {
      const { headers } = await signUp()
      const { reference } = (await api.post("/sellers/me/plan/upgrade", { return_url: back }, { headers })).data
      await api.post("/sellers/me/plan/confirm", { reference }, { headers })
      const until = new Date((await plan(headers)).plan.pro_paid_until).getTime()
      declineCharges = true

      const day = 86400000
      for (const [i, at] of [until - 12 * 3600 * 1000, until + day, until + 2 * day].entries()) {
        const r = await renewDuePro(getContainer(), new Date(at))
        expect(r).toEqual([expect.objectContaining({ status: "failed" })])
        expect((await plan(headers)).billing.failures).toBe(i + 1)
      }
      expect((await plan(headers)).billing.auto_renew).toBe(false)
      expect(await renewDuePro(getContainer(), new Date(until + 3 * day))).toEqual([])
      expect(charges).toHaveLength(3)
    })

    it("sellers can stop and restart renewal; prices in other currencies are converted", async () => {
      const { headers } = await signUp("GH", "gh@example.com")
      // Ghana's price (GHS 375) is charged in NGN, AQUENORA's Paystack currency, rounded up.
      const billing = (await plan(headers)).billing
      expect(billing.charge.currency_code).toBe("ngn")
      expect(billing.charge.amount % 100).toBe(0)
      expect(billing.charge.amount).toBeGreaterThan(30000)

      expect((await err(api.post("/sellers/me/plan/auto-renew", { on: true }, { headers }))).status).toBe(400)
      const { reference } = (await api.post("/sellers/me/plan/upgrade", { return_url: back }, { headers })).data
      await api.post("/sellers/me/plan/confirm", { reference }, { headers })
      expect((await api.post("/sellers/me/plan/auto-renew", { on: false }, { headers })).data.billing.auto_renew).toBe(false)
      const until = new Date((await plan(headers)).plan.pro_paid_until).getTime()
      expect(await renewDuePro(getContainer(), new Date(until - 3600 * 1000))).toEqual([])
      expect((await api.post("/sellers/me/plan/auto-renew", { on: true }, { headers })).data.billing.auto_renew).toBe(true)
    })

    it("a card Paystack can't charge again: Pro is paid, renewal stays off", async () => {
      reusableCard = false
      const { headers } = await signUp("NG", "noreuse@example.com")
      const { reference } = (await api.post("/sellers/me/plan/upgrade", { return_url: back }, { headers })).data
      await api.post("/sellers/me/plan/confirm", { reference }, { headers })
      const p = await plan(headers)
      expect(p.plan.status).toBe("paid")
      expect(p.billing).toMatchObject({ card: null, auto_renew: false })
      // Someone else's payment can't be confirmed.
      const other = await signUp("NG", "other@example.com")
      expect((await err(api.post("/sellers/me/plan/confirm", { reference }, { headers: other.headers }))).status).toBe(404)
    })
  },
})
