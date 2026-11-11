import http from "node:http"
import crypto from "node:crypto"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

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

    async function setup() {
      const email = "shop@example.com"
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      await api.post("/sellers", { name: "Adire House" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const headers = { authorization: `Bearer ${login.data.token}` }
      const product = (await api.post("/sellers/me/products", { title: "Kimono", price: 28000, stock: 3 }, { headers })).data.product
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      const store = { headers: { "x-publishable-api-key": key.token } }
      return { headers, product, store }
    }
    const buyer = (product_id: string, quantity = 2) => ({
      email: "Buyer@Example.com",
      name: "Kwame Mensah",
      phone: "+234 801 234 5678",
      fulfillment: "delivery",
      address: "5 Allen Avenue",
      city: "Ikeja, Lagos",
      country: "NG",
      marketing_opt_in: true,
      return_url: "https://adirehouse.aquenora.test/",
      items: [{ product_id, quantity }],
    })

    it("connects a bank account as a Paystack subaccount", async () => {
      const { headers, store } = await setup()
      expect((await api.get("/store/sellers/adirehouse", store)).data.store.accepts_payments).toBe(false)

      const banks = (await api.get("/sellers/me/payouts/banks", { headers })).data.banks
      expect(banks.map((b: { code: string }) => b.code)).toEqual(["044", "058"])

      const wrong = await err(api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0000000000" }, { headers }))
      expect(wrong.status).toBe(400)
      expect(wrong.data.message).toContain("Could not resolve account name")
      expect((await err(api.post("/sellers/me/payouts", { bank_code: "999", account_number: "0123456789" }, { headers }))).status).toBe(400)

      const seller = (await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })).data.seller
      expect(seller.paystack_subaccount_code).toBe("ACCT_1")
      expect(seller.payout).toMatchObject({ bank_name: "Access Bank", account_last4: "6789", account_name: "ADAEZE OKAFOR" })
      expect(paystack.subaccounts[0]).toMatchObject({ method: "POST", business_name: "Adire House", settlement_bank: "044", percentage_charge: 3 })
      expect((await api.get("/store/sellers/adirehouse", store)).data.store.accepts_payments).toBe(true)
      // The public store never shows the subaccount code.
      expect((await api.get("/store/sellers/adirehouse", store)).data.store.paystack_subaccount_code).toBeUndefined()

      // Changing the bank updates the same subaccount.
      const again = (await api.post("/sellers/me/payouts", { bank_code: "058", account_number: "0987654321" }, { headers })).data.seller
      expect(again.paystack_subaccount_code).toBe("ACCT_1")
      expect(paystack.subaccounts[1]).toMatchObject({ method: "PUT", settlement_bank: "058" })
    })

    it("splits a payment and records exactly one order", async () => {
      const { headers, product, store } = await setup()
      // No bank account yet: no checkout.
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id), store))).status).toBe(400)
      const code = (await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })).data.seller
        .paystack_subaccount_code

      // Checks: stock, address, return address.
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 4), store))).data.message).toBe("Only 3 left of Kimono.")
      expect((await err(api.post("/store/sellers/adirehouse/checkout", { ...buyer(product.id), address: undefined }, store))).status).toBe(400)
      expect((await err(api.post("/store/sellers/adirehouse/checkout", { ...buyer(product.id), return_url: "https://evil.example/" }, store))).status).toBe(400)

      const started = (await api.post("/store/sellers/adirehouse/checkout", buyer(product.id), store)).data
      expect(started.authorization_url).toBe(`https://checkout.paystack.test/${started.reference}`)
      expect(started.amount).toBe(56000)

      // What Paystack was asked: seller's subaccount, AQUENORA's 3% as transaction_charge, Paystack fee from the seller.
      const tx = paystack.transactions.get(started.reference)!
      expect(tx.body).toMatchObject({
        email: "buyer@example.com",
        amount: 5600000,
        currency: "NGN",
        subaccount: code,
        transaction_charge: 168000,
        bearer: "subaccount",
      })
      expect(tx.body.callback_url).toBe(`https://adirehouse.aquenora.test/?reference=${started.reference}`)

      // The return page and the webhook both confirm; only one order is made.
      const [a, b] = await Promise.all([
        api.post("/store/payments/verify", { reference: started.reference }, store),
        api.post("/store/payments/verify", { reference: started.reference }, store),
      ])
      expect(a.data.status).toBe("paid")
      expect(b.data.order.id).toBe(a.data.order.id)

      const orders = (await api.get("/sellers/me/orders", { headers })).data.orders
      expect(orders).toHaveLength(1)
      expect(orders[0]).toMatchObject({ customer_name: "Kwame Mensah", email: "buyer@example.com", status: "new", fulfillment: "delivery", total: 56000 })

      // Stock went down; real fees are used in Financials.
      const products = (await api.get("/sellers/me/products", { headers })).data.products
      expect(products[0].stock).toBe(1)
      await api.post("/sellers/me/plan/trial", {}, { headers })
      const finance = (await api.get("/sellers/me/finance?period=all", { headers })).data
      expect(finance.fee_basis).toBe("actual")
      expect(finance.totals).toMatchObject({ revenue: 56000, payment_fees: 520, platform_fees: 1680 })
    })

    it("webhook: checks Paystack's signature, then records the order", async () => {
      const { headers, product, store } = await setup()
      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })
      const { reference } = (await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 1), store)).data
      const event = { event: "charge.success", data: { reference } }
      const raw = JSON.stringify(event)
      const sign = (key: string) => crypto.createHmac("sha512", key).update(raw).digest("hex")
      const post = (sig: string) =>
        err(api.post("/paystack/webhook", raw, { headers: { "content-type": "application/json", "x-paystack-signature": sig } }))

      expect((await post(sign("sk_test_wrong"))).status).toBe(401)
      expect((await api.get("/sellers/me/orders", { headers })).data.orders).toHaveLength(0)

      expect((await post(sign(SECRET))).status).toBe(200)
      expect((await post(sign(SECRET))).status).toBe(200) // Paystack may send it twice
      expect((await api.get("/sellers/me/orders", { headers })).data.orders).toHaveLength(1)

      // The buyer's return page afterwards finds the same order.
      const back = (await api.post("/store/payments/verify", { reference }, store)).data
      expect(back.status).toBe("paid")
    })

    it("pickup checkout needs pickup on; failed payments make no order", async () => {
      const { headers, product, store } = await setup()
      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })
      const pickupBuyer = { ...buyer(product.id, 1), fulfillment: "pickup", address: undefined, city: undefined }
      expect((await err(api.post("/store/sellers/adirehouse/checkout", pickupBuyer, store))).data.message).toBe("This store doesn't offer pickup.")

      const delivery = (await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 1), store)).data
      paystack.transactions.get(delivery.reference)!.status = "failed"
      const res = (await api.post("/store/payments/verify", { reference: delivery.reference }, store)).data
      expect(res.status).toBe("failed")
      expect((await api.get("/sellers/me/orders", { headers })).data.orders).toHaveLength(0)
      expect((await err(api.post("/store/payments/verify", { reference: "aq_nope" }, store))).status).toBe(404)
    })
  },
})
