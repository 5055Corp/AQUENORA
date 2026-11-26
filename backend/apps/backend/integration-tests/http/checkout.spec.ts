import http from "node:http"
import crypto from "node:crypto"
import type { AddressInfo } from "node:net"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { remindAbandonedBagsWorkflow } from "../../src/workflows/abandoned-bags"

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
      const { seller: created } = (await api.post("/sellers", { name: "Adire House" }, { headers: { authorization: `Bearer ${reg.data.token}` } })).data
      // AQUENORA has checked this seller (verification has its own tests).
      await (getContainer().resolve("seller") as { updateSellers: (d: unknown) => Promise<unknown> }).updateSellers({ id: created.id, verification_status: "verified" })
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

    it("prices options, keeps stock per choice and records the buyer's choices and note", async () => {
      const { headers, store } = await setup()
      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })

      // Up to 7 options; 8 is too many.
      const many = Array.from({ length: 8 }, (_, i) => ({ name: `Option ${i}`, choices: [{ label: "A" }] }))
      expect((await err(api.post("/sellers/me/products", { title: "Too many", price: 1000, options: { groups: many } }, { headers }))).status).toBe(400)

      const wig = (await api.post("/sellers/me/products", {
        title: "Wig",
        price: 45000,
        note_prompt: "Head size, or any special requests",
        options: {
          stock_per_choice: true,
          groups: [
            { name: "Length", choices: [{ label: "12 inch", price: 45000, stock: 2 }, { label: "20 inch", price: 60000, stock: 1 }] },
            { name: "Colour", choices: [{ label: "Black" }, { label: "Blonde", extra: 5000 }] },
          ],
        },
      }, { headers })).data.product
      expect(wig).toMatchObject({ stock: 3, from_price: 45000, note_prompt: "Head size, or any special requests" })
      const shown = (await api.get("/store/sellers/adirehouse", store)).data.products.find((p: { id: string }) => p.id === wig.id)
      expect(shown.options.groups.map((g: { name: string }) => g.name)).toEqual(["Length", "Colour"])

      const bag = (items: unknown[]) => ({ ...buyer(wig.id), items })
      // Choices are required, must exist, and stock is per length.
      expect((await err(api.post("/store/sellers/adirehouse/checkout", bag([{ product_id: wig.id, quantity: 1 }]), store))).data.message).toBe("Choose length, colour for Wig.")
      expect((await err(api.post("/store/sellers/adirehouse/checkout", bag([{ product_id: wig.id, quantity: 1, choices: ["30 inch", "Black"] }]), store))).status).toBe(400)
      expect((await err(api.post("/store/sellers/adirehouse/checkout", bag([
        { product_id: wig.id, quantity: 1, choices: ["20 inch", "Black"] },
        { product_id: wig.id, quantity: 1, choices: ["20 inch", "Blonde"] },
      ]), store))).data.message).toBe("Only 1 left of Wig (20 inch, Blonde).")

      // 20" blonde (60,000 + 5,000) + 12" black (45,000): the server works out the price.
      const started = (await api.post("/store/sellers/adirehouse/checkout", bag([
        { product_id: wig.id, quantity: 1, choices: ["20 inch", "Blonde"], note: "Medium cap, baby hairs please" },
        { product_id: wig.id, quantity: 1, choices: ["12 inch", "Black"] },
      ]), store)).data
      expect(started.amount).toBe(110000)
      const verified = (await api.post("/store/payments/verify", { reference: started.reference }, store)).data

      // Tracking: the buyer's signed link shows the order (no email, phone or street); a changed link doesn't.
      const tracked = (await api.get(`/store/orders/track/${verified.track_token}`, store)).data
      expect(tracked.order).toMatchObject({ status: "new", fulfillment: "delivery", total: 110000, made_to_order_days: null, place: "Ikeja, Lagos" })
      expect(tracked.order.items[0]).toMatchObject({ title: "Wig (20 inch, Blonde)", note: "Medium cap, baby hairs please" })
      expect(tracked.store).toMatchObject({ name: "Adire House", handle: "adirehouse" })
      expect(JSON.stringify(tracked)).not.toMatch(/buyer@example|5 Allen|801 234/i)
      expect((await err(api.get(`/store/orders/track/${verified.track_token.slice(0, -2)}xx`, store))).status).toBe(404)
      // The buyer got an "order confirmed" email from orders@ with the tracking link.
      const mail = (await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ to: "buyer@example.com" }))
        .find((n: { template: string }) => n.template === "aquenora-order-confirmed") as unknown as { from?: string; data: { subject: string; text: string } }
      expect(mail.from).toContain("orders@aquenora.com")
      expect(mail.data.subject).toContain("confirmed")
      expect(mail.data.text).toContain(`track=${encodeURIComponent(verified.track_token)}`)

      const [order] = (await api.get("/sellers/me/orders", { headers })).data.orders
      expect(order.items).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: "Wig (20 inch, Blonde)", unit_price: 65000, note: "Medium cap, baby hairs please", options: [{ name: "Length", value: "20 inch" }, { name: "Colour", value: "Blonde" }] }),
        expect.objectContaining({ title: "Wig (12 inch, Black)", unit_price: 45000, note: null }),
      ]))
      // Each length's own stock went down.
      const after = (await api.get("/sellers/me/products", { headers })).data.products.find((p: { id: string }) => p.id === wig.id)
      expect(after.options.groups[0].choices.map((c: { stock: number }) => c.stock)).toEqual([1, 0])
      expect(after.stock).toBe(1)

      // Made to order: no stock needed, never sold out.
      const dress = (await api.post("/sellers/me/products", { title: "Tailored dress", price: 30000, stock: 0, made_to_order_days: 7 }, { headers })).data.product
      expect(dress.made_to_order_days).toBe(7)
      const made = (await api.post("/store/sellers/adirehouse/checkout", { ...buyer(dress.id), items: [{ product_id: dress.id, quantity: 3 }] }, store)).data
      expect(made.amount).toBe(90000)

      // Editing options: removing them goes back to one price.
      const plain = (await api.post(`/sellers/me/products/${wig.id}`, { options: null }, { headers })).data.product
      expect(plain.options).toBeNull()
    })

    it("back in stock: shoppers ask to be told, and are emailed once when the seller restocks", async () => {
      const { headers, product, store } = await setup()
      // In stock: nothing to wait for.
      expect((await err(api.post(`/store/products/${product.id}/notify`, { email: "a@example.com" }, store))).status).toBe(400)
      await api.post(`/sellers/me/products/${product.id}`, { stock: 0 }, { headers })
      expect((await err(api.post(`/store/products/${product.id}/notify`, { email: "not-an-email" }, store))).status).toBe(400)
      await api.post(`/store/products/${product.id}/notify`, { email: "A@Example.com" }, store)
      await api.post(`/store/products/${product.id}/notify`, { email: "a@example.com" }, store) // twice = once
      await api.post(`/store/products/${product.id}/notify`, { email: "b@example.com" }, store)

      // A wig whose 20 inch is sold out.
      const groups = (stock20: number) => [{ name: "Length", choices: [{ label: "12 inch", stock: 2 }, { label: "20 inch", stock: stock20 }] }]
      const wig = (await api.post("/sellers/me/products", { title: "Wig", price: 45000, options: { stock_per_choice: true, groups: groups(0) } }, { headers })).data.product
      expect((await err(api.post(`/store/products/${wig.id}/notify`, { email: "c@example.com", choice: "12 inch" }, store))).status).toBe(400)
      await api.post(`/store/products/${wig.id}/notify`, { email: "c@example.com", choice: "20 inch" }, store)

      expect((await api.get("/sellers/me/stock-alerts", { headers })).data.waiting).toEqual({ [product.id]: { "": 2 }, [wig.id]: { "20 inch": 1 } })

      const notifications = getContainer().resolve(Modules.NOTIFICATION)
      const sent = async () => (await notifications.listNotifications({ template: "aquenora-back-in-stock" })).map((n: { to: string }) => n.to).sort()
      // Editing something else doesn't email anyone; restocking does, once.
      await api.post(`/sellers/me/products/${product.id}`, { title: "Kimono (indigo)" }, { headers })
      expect(await sent()).toEqual([])
      await api.post(`/sellers/me/products/${product.id}`, { stock: 4 }, { headers })
      expect(await sent()).toEqual(["a@example.com", "b@example.com"])
      await api.post(`/sellers/me/products/${product.id}`, { stock: 5 }, { headers })
      expect(await sent()).toEqual(["a@example.com", "b@example.com"])
      const mail = (await notifications.listNotifications({ template: "aquenora-back-in-stock" }))[0] as unknown as { data: { subject: string } }
      expect(mail.data.subject).toBe("It's back: Kimono (indigo) at Adire House")

      await api.post(`/sellers/me/products/${wig.id}`, { options: { stock_per_choice: true, groups: groups(3) } }, { headers })
      expect(await sent()).toEqual(["a@example.com", "b@example.com", "c@example.com"])
      expect((await api.get("/sellers/me/stock-alerts", { headers })).data.waiting).toEqual({})
    })

    it("abandoned bags: one reminder an hour later with a link that refills the bag; none if they paid", async () => {
      const { headers, product, store } = await setup()
      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })
      const later = (h: number) => new Date(Date.now() + h * 3600000).toISOString()
      const remind = async (h: number) => (await remindAbandonedBagsWorkflow(getContainer()).run({ input: { now: later(h) } })).result
      const sent = async () => (await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ template: "aquenora-abandoned-bag" })) as unknown as { to: string; data: { subject: string; text: string } }[]

      // Kwame starts paying twice and stops; Ada starts and then pays.
      await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 1), store)
      await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 2), store)
      const ada = (await api.post("/store/sellers/adirehouse/checkout", { ...buyer(product.id, 1), email: "ada@example.com", name: "Ada Obi" }, store)).data
      await api.post("/store/payments/verify", { reference: ada.reference }, store)

      expect(await remind(0.5)).toBe(0) // too soon: they may still be paying
      expect(await remind(2)).toBe(1)
      const [mail] = await sent()
      expect(mail.to).toBe("buyer@example.com")
      expect(mail.data.subject).toBe("You left something in your bag at Adire House")
      expect(mail.data.text).toContain("Hi Kwame")
      expect(mail.data.text).toContain("2 × Kimono")
      const bag = new URL(mail.data.text.match(/https?:\/\/\S+/)![0]).searchParams.get("bag")!
      expect(JSON.parse(Buffer.from(bag, "base64url").toString())).toEqual({ [product.id]: 2 })
      // Only once, and not again for the next 7 days.
      expect(await remind(3)).toBe(0)
      await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 1), store)
      expect(await remind(2.5)).toBe(0)
      expect(await sent()).toHaveLength(1)
    })

    it("imports products from a spreadsheet: good rows are added, bad ones reported", async () => {
      const { headers } = await setup()
      const res = (await api.post("/sellers/me/product-imports", { products: [
        { title: "Bone straight wig", price: 85000, stock: 4, cost_price: 50000, description: "Soft and full",
          options: { stock_per_choice: false, groups: [{ name: "Length", choices: [{ label: "12 inch" }, { label: "20 inch", extra: 15000 }] }] } },
        { title: "Ankara tote", price: 12000, made_to_order_days: 5 },
      ] }, { headers })).data
      expect(res).toEqual({ created: 2, failed: [] })
      const titles = (await api.get("/sellers/me/products", { headers })).data.products.map((p: { title: string }) => p.title)
      expect(titles).toEqual(expect.arrayContaining(["Bone straight wig", "Ankara tote"]))
      // The whole file is checked first: a bad row is a 400 that says which one.
      const bad = await err(api.post("/sellers/me/product-imports", { products: [{ title: "", price: 100 }] }, { headers }))
      expect(bad.status).toBe(400)
      expect((await err(api.post("/sellers/me/product-imports", { products: Array.from({ length: 201 }, () => ({ title: "x", price: 1 })) }, { headers }))).status).toBe(400)
      expect((await err(api.post("/sellers/me/product-imports", { products: [{ title: "x", price: 1 }] }))).status).toBe(401)
    })

    it("new devices confirm with an emailed code; the first device is trusted", async () => {
      const { headers } = await setup()
      const phone = { headers: { ...headers, "x-aq-device": "phone-1111111111111111" } }
      const laptop = { headers: { ...headers, "x-aq-device": "laptop-222222222222222" } }
      // Old app (no device id): still works until REQUIRE_DEVICE_CODE is turned on.
      expect((await api.get("/sellers/me", { headers })).status).toBe(200)
      // The first device seen is trusted; a second one has to confirm.
      expect((await api.get("/sellers/me", phone)).status).toBe(200)
      const blocked = (await err(api.get("/sellers/me/orders", laptop))) as unknown as { status: number; data: { type: string } }
      expect(blocked.status).toBe(403)
      expect(blocked.data.type).toBe("device_unverified")

      expect((await api.post("/sellers/me/device-code", { device_name: "Chrome on Mac" }, laptop)).data.sent_to).toBe("s***@example.com")
      // Wait a minute before another.
      expect((await err(api.post("/sellers/me/device-code", {}, laptop))).status).toBe(400)
      const mails = await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ template: "aquenora-login-code" }) as unknown as { to: string; data: { subject: string } }[]
      expect(mails[0].to).toBe("shop@example.com")
      const code = mails[0].data.subject.slice(0, 6)
      const wrong = code === "000000" ? "111111" : "000000"
      expect((await err(api.post("/sellers/me/device-code/verify", { code: wrong }, laptop))).data.message).toContain("4 tries left")
      // The code only works on the device that asked for it.
      expect((await err(api.post("/sellers/me/device-code/verify", { code }, { headers: { ...headers, "x-aq-device": "other-33333333333333333" } }))).status).toBe(400)
      expect((await api.post("/sellers/me/device-code/verify", { code }, laptop)).data.trusted).toBe(true)
      expect((await api.get("/sellers/me/orders", laptop)).status).toBe(200)
      expect((await api.get("/sellers/me", phone)).status).toBe(200)
      // Used once only.
      expect((await err(api.post("/sellers/me/device-code/verify", { code }, laptop))).status).toBe(400)
    })

    it("push notifications: the app saves this iPhone, and forgets it on log-out", async () => {
      const { headers } = await setup()
      const token = "a".repeat(64)
      expect((await err(api.post("/sellers/me/push-token", { token: "not-a-token" }, { headers }))).status).toBe(400)
      await api.post("/sellers/me/push-token", { token }, { headers })
      await api.post("/sellers/me/push-token", { token }, { headers }) // twice = once
      const sellers = getContainer().resolve("seller") as { listSellers: (f: unknown) => Promise<{ push_tokens: { token: string }[] | null }[]> }
      expect((await sellers.listSellers({ handle: "adirehouse" }))[0].push_tokens?.map((t) => t.token)).toEqual([token])
      await api.delete("/sellers/me/push-token", { headers, data: { token } })
      expect((await sellers.listSellers({ handle: "adirehouse" }))[0].push_tokens).toEqual([])
    })

    it("referrals: both sellers get a free Pro month after the invited store's first sale", async () => {
      const { headers, store } = await setup()
      // A new seller signs up from Adire House's invite link.
      const reg = await api.post("/auth/seller/emailpass/register", { email: "new@example.com", password })
      await api.post("/sellers", { name: "Kente Corner", referral: "adirehouse" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const sellers = getContainer().resolve("seller") as { listSellers: (f: unknown) => Promise<{ id: string; pro_paid_until: Date | null }[]>; updateSellers: (d: unknown) => Promise<unknown> }
      const [kente] = await sellers.listSellers({ handle: "kentecorner" })
      await sellers.updateSellers({ id: kente.id, verification_status: "verified" })
      const login = await api.post("/auth/seller/emailpass", { email: "new@example.com", password })
      const kh = { headers: { authorization: `Bearer ${login.data.token}` } }
      expect((await api.get("/sellers/me/referrals", { headers })).data).toMatchObject({ joined: 1, rewarded: 0 })
      expect((await api.get("/sellers/me/referrals", { headers })).data.link).toContain("ref=adirehouse")

      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, kh)
      const cloth = (await api.post("/sellers/me/products", { title: "Kente cloth", price: 20000, stock: 5 }, kh)).data.product
      const pay = async () => {
        const started = (await api.post("/store/sellers/kentecorner/checkout", { ...buyer(cloth.id, 1), return_url: "https://kentecorner.aquenora.test/" }, store)).data
        await api.post("/store/payments/verify", { reference: started.reference }, store)
      }
      await pay()
      const pro = async (h: { headers: Record<string, string> }) => (await api.get("/sellers/me/plan", h)).data
      const month = 27 * 86400000
      for (const h of [kh, { headers }]) {
        const { plan } = await pro(h)
        expect(plan.id ?? plan.name ?? "pro").toBeTruthy()
        expect(new Date(plan.pro_paid_until).getTime() - Date.now()).toBeGreaterThan(month)
      }
      expect((await api.get("/sellers/me/referrals", { headers })).data).toMatchObject({ joined: 1, rewarded: 1 })
      const mails = (await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ template: "aquenora-referral-reward" })) as unknown as { to: string }[]
      expect(mails.map((m) => m.to).sort()).toEqual(["new@example.com", "shop@example.com"])
      // Only once.
      await pay()
      expect(await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ template: "aquenora-referral-reward" })).toHaveLength(2)
    })

    it("disputes: buyer reports, seller refunds directly, buyer confirms; AQUENORA can step in and moderate", async () => {
      const { headers, product, store } = await setup()
      await api.post("/sellers/me/payouts", { bank_code: "044", account_number: "0123456789" }, { headers })
      const started = (await api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 1), store)).data
      const { track_token: token } = (await api.post("/store/payments/verify", { reference: started.reference }, store)).data
      const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64")

      // The buyer reports a problem from their tracking link (with a photo); only once.
      const opened = (await api.post(`/store/orders/track/${token}/dispute`, { reason: "wrong_item", message: "I got the wrong colour.", files: [{ mime_type: "image/jpeg", data: JPG }] }, store)).data.dispute
      expect(opened).toMatchObject({ status: "open", reason: "wrong_item", can_escalate: false })
      expect((await err(api.post(`/store/orders/track/${token}/dispute`, { reason: "damaged", message: "Again" }, store))).status).toBe(400)
      expect((await err(api.patch(`/store/orders/track/${token}/dispute`, { action: "escalate" }, store))).status).toBe(400)
      // A tampered link can't see or open anything.
      expect((await err(api.post(`/store/orders/track/${token.slice(0, -2)}xx/dispute`, { reason: "damaged", message: "Hello" }, store))).status).toBe(404)

      // The seller sees it, opens the photo, replies, then marks it refunded.
      const [mine] = (await api.get("/sellers/me/disputes", { headers })).data.disputes
      expect(mine.id).toBe(opened.id)
      const fileId = mine.messages[0].files[0]
      const photo = await api.get(`/sellers/me/disputes/${mine.id}/files/${fileId}`, { headers, responseType: "arraybuffer" })
      expect(photo.headers["content-type"]).toContain("image/jpeg")
      expect(photo.headers["cache-control"]).toContain("no-store")
      expect((await api.post(`/sellers/me/disputes/${mine.id}`, { action: "message", text: "So sorry! I'll refund you now." }, { headers })).data.dispute.status).toBe("replied")
      const refunded = (await api.post(`/sellers/me/disputes/${mine.id}`, { action: "refunded", amount: 28000, text: "Sent by transfer" }, { headers })).data.dispute
      expect(refunded).toMatchObject({ status: "refunded", refund: { amount: 28000, note: "Sent by transfer" }, can_escalate: true })

      // The buyer sees it on the tracking page and confirms; the problem closes.
      expect((await api.get(`/store/orders/track/${token}`, store)).data.dispute.status).toBe("refunded")
      expect((await api.patch(`/store/orders/track/${token}/dispute`, { action: "confirm" }, store)).data.dispute.status).toBe("resolved")
      expect((await err(api.post(`/sellers/me/disputes/${mine.id}`, { action: "message", text: "hi" }, { headers }))).status).toBe(400)
      const mail = await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ to: "shop@example.com" })
      expect(mail.some((n: { template: string }) => n.template === "aquenora-dispute")).toBe(true)

      // Admin: sees it, and needs a login.
      const adminReg = await api.post("/auth/user/emailpass/register", { email: "owner@aquenora.com", password })
      const { createUserAccountWorkflow } = await import("@medusajs/medusa/core-flows")
      const authIdentityId = JSON.parse(Buffer.from(adminReg.data.token.split(".")[1], "base64").toString()).auth_identity_id
      await createUserAccountWorkflow(getContainer()).run({ input: { authIdentityId, userData: { email: "owner@aquenora.com" } } })
      const admin = { authorization: `Bearer ${(await api.post("/auth/user/emailpass", { email: "owner@aquenora.com", password })).data.token}` }
      expect((await err(api.get("/admin/disputes"))).status).toBe(401)
      expect((await api.get("/admin/disputes?status=all", { headers: admin })).data.disputes[0]).toMatchObject({ status: "resolved", seller: { name: "Adire House" } })

      // Reports: a shopper reports the product; AQUENORA hides it; it leaves the store and can't be bought.
      expect((await api.post(`/store/products/${product.id}/report`, { reason: "counterfeit", note: "Fake brand" }, store)).status).toBe(201)
      const [report] = (await api.get("/admin/reports", { headers: admin })).data.reports
      expect(report).toMatchObject({ count: 1, reasons: { counterfeit: 1 }, product: { title: "Kimono", hidden: false } })
      await api.post(`/admin/reports/${report.report_id}`, { action: "hide", reason: "Counterfeit brand" }, { headers: admin })
      expect((await api.get("/store/sellers/adirehouse", store)).data.products).toHaveLength(0)
      expect((await err(api.post("/store/sellers/adirehouse/checkout", buyer(product.id, 1), store))).status).toBe(400)
      expect((await api.get("/sellers/me/products", { headers })).data.products[0]).toMatchObject({ hidden: true, hidden_reason: "Counterfeit brand" })
      await api.post(`/admin/products/${product.id}/unhide`, {}, { headers: admin })
      expect((await api.get("/store/sellers/adirehouse", store)).data.products).toHaveLength(1)

      // Suspending a store hides it completely; restoring brings it back.
      const sellerId = (await api.get("/sellers/me", { headers })).data.seller.id
      expect((await err(api.post(`/admin/sellers/${sellerId}/suspend`, { suspend: true }, { headers: admin }))).status).toBe(400)
      await api.post(`/admin/sellers/${sellerId}/suspend`, { suspend: true, reason: "Unpaid refund" }, { headers: admin })
      expect((await err(api.get("/store/sellers/adirehouse", store))).status).toBe(404)
      await api.post(`/admin/sellers/${sellerId}/suspend`, { suspend: false }, { headers: admin })
      expect((await api.get("/store/sellers/adirehouse", store)).status).toBe(200)

      // Owner overview.
      const overview = (await api.get("/admin/overview", { headers: admin })).data
      expect(overview).toMatchObject({ orders: 1, sales: { ngn: 28000 }, sellers: { total: 1, new: 1 }, top_stores: [{ name: "Adire House", orders: 1 }] })
      expect(overview.commission.ngn).toBeGreaterThan(0)
      // Finding a store (owner screens in the app).
      expect((await api.get("/admin/sellers?q=adire", { headers: admin })).data.sellers).toMatchObject([{ name: "Adire House", handle: "adirehouse" }])
      expect((await api.get("/admin/sellers?q=nothing-like-this", { headers: admin })).data.sellers).toEqual([])
      expect((await err(api.get("/admin/sellers?q=adire"))).status).toBe(401)
    })
  },
})
