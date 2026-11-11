import http from "node:http"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)
const password = "supersecret123"
const SECRET = "sk_test_fake_intl"

// A small fake Paystack: banks, subaccounts, payments that always succeed.
const sent = new Map<string, Record<string, unknown>>()
const server = http.createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => {
    const send = (json: unknown) => {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify({ status: true, message: "ok", data: json }))
    }
    const url = new URL(req.url!, "http://x")
    const data = body ? JSON.parse(body) : {}
    if (url.pathname === "/bank") return send([{ name: "Access Bank", code: "044" }])
    if (url.pathname === "/bank/resolve") return send({ account_name: "ADAEZE OKAFOR" })
    if (url.pathname.startsWith("/subaccount")) return send({ subaccount_code: "ACCT_intl" })
    if (url.pathname === "/transaction/initialize") {
      sent.set(data.reference, data)
      return send({ authorization_url: "https://paystack.test/x", reference: data.reference })
    }
    const ref = url.pathname.split("/").pop()!
    const tx = sent.get(ref)!
    return send({ id: 1, status: "success", reference: ref, amount: tx.amount, currency: tx.currency, fees: 120000, authorization: { country_code: "CA" }, metadata: {} })
  })
})

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  process.env.PAYSTACK_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.PAYSTACK_SECRET_KEY = SECRET
  process.env.STORE_DOMAIN = "aquenora.test"
  process.env.EXCHANGE_RATES_URL = "" // no network in tests: built-in rates
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const from = { name: "Adire House", address: "12 Admiralty Way", city: "Lagos", region: "Lagos", postal_code: "106104", country: "NG", phone: "+2348012345678" }
const dhl = { id: "dhl", carrier: "dhl", name: "DHL Express Worldwide", price: 45000, days: "3-5 working days", zone: "international", continents: ["EU", "NA"] }
const local = { id: "gig", carrier: "local", name: "GIG Logistics", price: 3500, days: "1-3 days", zone: "domestic", continents: [] }

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    type Res = { status: number; data: { message: string } }
    const err = (p: Promise<unknown>): Promise<Res> => p.then(() => ({ status: 200, data: { message: "" } }), (e) => e.response)

    async function setup() {
      const email = "shop@example.com"
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      await api.post("/sellers", { name: "Adire House" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const headers = { authorization: `Bearer ${login.data.token}` }
      const product = (await api.post("/sellers/me/products", { title: "Kimono", price: 28000, stock: 5 }, { headers })).data.product
      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      return { headers, product, store: { headers: { "x-publishable-api-key": key.token } } }
    }
    const buyer = (product_id: string, extra: Record<string, unknown>) => ({
      email: "amara@example.ca",
      name: "Amara Diallo",
      phone: "+1 416 555 0199",
      fulfillment: "delivery",
      address: "200 Bay Street, Apt 1203",
      city: "Toronto",
      region: "Ontario",
      postal_code: "M5J 2J2",
      country: "CA",
      display_currency: "CAD",
      return_url: "https://adirehouse.aquenora.test/",
      items: [{ product_id, quantity: 1 }],
      ...extra,
    })

    it("saves shipping options and checks them", async () => {
      const { headers, store } = await setup()
      const saved = (await api.post("/sellers/me", { shipping: { from, options: [dhl, local] } }, { headers })).data.seller.shipping
      expect(saved.options).toHaveLength(2)

      const bad = async (shipping: unknown) => (await err(api.post("/sellers/me", { shipping }, { headers }))).status
      expect(await bad({ from, options: [{ ...dhl, continents: [] }] })).toBe(400)
      expect(await bad({ from, options: [dhl, dhl] })).toBe(400)
      expect(await bad({ from: { ...from, country: "XX" }, options: [] })).toBe(400)
      expect(await bad({ from, options: [{ ...dhl, carrier: "pigeon" }] })).toBe(400)

      // Buyers see the options, not the seller's ship-from address.
      const pub = (await api.get("/store/sellers/adirehouse", store)).data.store
      expect(pub.shipping).toEqual({ ships_from: "NG", options: saved.options })
      expect(JSON.stringify(pub)).not.toContain("106104")
    })

    it("a buyer in Canada pays items + DHL; AQUENORA's fee is on the items only", async () => {
      const { headers, product, store } = await setup()
      await api.post("/sellers/me", { shipping: { from, options: [dhl, local] } }, { headers })

      // Options must fit the country.
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, { shipping_option_id: "gig" }), store))).data.message).toBe(
        "Choose a delivery option."
      )
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, { country: "JP", shipping_option_id: "dhl" }), store))).data.message).toBe(
        "This shop doesn't deliver to Japan yet."
      )
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, { country: undefined }), store))).status).toBe(400)

      const started = (await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, { shipping_option_id: "dhl" }), store)).data
      expect(started.amount).toBe(73000)
      expect(sent.get(started.reference)).toMatchObject({ amount: 7300000, currency: "NGN", transaction_charge: 84000 })

      const paid = (await api.post("/store/payments/verify", { reference: started.reference }, store)).data
      expect(paid.checkout.shipping).toMatchObject({ name: "DHL Express Worldwide", price: 45000 })

      const [order] = (await api.get("/sellers/me/orders", { headers })).data.orders
      expect(order).toMatchObject({
        total: 28000,
        international: true,
        phone: "+1 416 555 0199",
        display_currency: "CAD",
        shipping: { carrier: "dhl", name: "DHL Express Worldwide", price: 45000, days: "3-5 working days" },
        address: { address: "200 Bay Street, Apt 1203", city: "Toronto", region: "Ontario", postal_code: "M5J 2J2", country: "CA" },
      })
    })

    it("shops without options deliver at home only; 'sell abroad' off blocks other countries", async () => {
      const { headers, product, store } = await setup()
      const lagos = { country: "NG", city: "Lagos", region: undefined, postal_code: undefined, display_currency: undefined }
      // No options: delivery at home is arranged with the buyer, abroad isn't possible.
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, lagos), store))).status).toBe(200)
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, {}), store))).data.message).toBe(
        "This shop doesn't deliver to Canada yet."
      )

      await api.post("/sellers/me", { sells_abroad: false, shipping: { from, options: [dhl, local] } }, { headers })
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, { shipping_option_id: "dhl" }), store))).data.message).toBe(
        "This shop only delivers within Nigeria."
      )
      const home = (await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, { ...lagos, shipping_option_id: "gig" }), store)).data
      expect(home.amount).toBe(31500)
    })

    it("exchange rates for showing prices in buyers' currencies", async () => {
      const { store } = await setup()
      const rates = (await api.get("/store/rates", store)).data
      expect(rates).toMatchObject({ base: "USD", source: "fallback" })
      expect(rates.rates.CAD).toBeGreaterThan(1)
      expect(rates.rates.NGN).toBeGreaterThan(100)
    })
  },
})
