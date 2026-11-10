import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { createSellerOrderWorkflow } from "../../src/workflows/create-seller-order"

jest.setTimeout(120 * 1000)

const password = "supersecret123"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function signUpSeller(email: string, body: Record<string, unknown>) {
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const created = await api.post("/sellers", body, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      return { seller: created.data.seller, headers: { authorization: `Bearer ${login.data.token}` } }
    }

    async function adminHeaders() {
      const reg = await api.post("/auth/user/emailpass/register", { email: "owner@aqenora.com", password })
      const authIdentityId = JSON.parse(Buffer.from(reg.data.token.split(".")[1], "base64").toString()).auth_identity_id
      await createUserAccountWorkflow(getContainer()).run({ input: { authIdentityId, userData: { email: "owner@aqenora.com" } } })
      const login = await api.post("/auth/user/emailpass", { email: "owner@aqenora.com", password })
      return { authorization: `Bearer ${login.data.token}` }
    }

    const placeOrder = (seller_id: string, items: { product_id: string; quantity: number }[], extra: Record<string, unknown> = {}) =>
      createSellerOrderWorkflow(getContainer()).run({
        input: { seller_id, email: "buyer@example.com", customer_name: "Ada Obi", items, ...extra },
      })

    describe("orders, cost prices and the Money page", () => {
      it("records orders with the cost price at the time of sale and works out profit", async () => {
        const { seller, headers } = await signUpSeller("ng@example.com", { name: "Adire House", country_code: "NG" })
        const kimono = (await api.post("/sellers/me/products", { title: "Kimono", price: 28000, stock: 9, cost_price: 15000 }, { headers })).data.product
        const tote = (await api.post("/sellers/me/products", { title: "Tote", price: 10000 }, { headers })).data.product
        expect(kimono.cost_price).toEqual(15000)
        expect(tote.cost_price).toBeNull()

        await placeOrder(seller.id, [{ product_id: kimono.id, quantity: 2 }])
        await placeOrder(seller.id, [{ product_id: tote.id, quantity: 1 }], { email: "Repeat@Example.com", customer_name: "Kofi Mensah" })

        // Raising the cost later must not change the first order's recorded cost.
        await api.post(`/sellers/me/products/${kimono.id}`, { cost_price: 20000 }, { headers })

        let money = (await api.get("/sellers/me/finance?period=7d", { headers })).data
        expect(money.currency_code).toEqual("ngn")
        expect(money.totals).toEqual(
          expect.objectContaining({ orders: 2, items_sold: 3, revenue: 66000, cost_of_goods: 30000, payment_fees: 1190, platform_fees: 1980, items_missing_cost: 1 })
        )
        // Free plan: AQENORA keeps 3% of each sale.
        expect(money.totals.profit).toEqual(66000 - 30000 - 1190 - 1980)

        // Adding the tote's cost price later fills in the gap for its earlier sale.
        const updated = (await api.post(`/sellers/me/products/${tote.id}`, { cost_price: 4000, stock: 3, price: 12000 }, { headers })).data.product
        expect(updated).toEqual(expect.objectContaining({ cost_price: 4000, stock: 3, price: 12000 }))
        // Free plan shows totals only; the charts and profit per product need Pro (or the trial).
        money = (await api.get("/sellers/me/finance?period=30d", { headers })).data
        expect(money.locked).toBe(true)
        await api.post("/sellers/me/plan/trial", {}, { headers })
        money = (await api.get("/sellers/me/finance?period=30d", { headers })).data
        expect(money.locked).toBe(false)
        expect(money.totals.cost_of_goods).toEqual(34000)
        expect(money.totals.items_missing_cost).toEqual(0)
        expect(money.series).toHaveLength(30)
        expect(money.by_product.map((p: { title: string }) => p.title)).toEqual(["Kimono", "Tote"])

        const bad = await api.get("/sellers/me/finance?period=year", { headers }).catch((e) => e.response)
        expect(bad.status).toEqual(400)
      })

      it("lists the seller's orders and moves them from paid to shipped to delivered", async () => {
        const { seller, headers } = await signUpSeller("orders@example.com", { name: "Lagos Looks" })
        const p = (await api.post("/sellers/me/products", { title: "Wrap", price: 5000 }, { headers })).data.product
        const { result: order } = await placeOrder(seller.id, [{ product_id: p.id, quantity: 3 }], { international: true })

        const list = (await api.get("/sellers/me/orders", { headers })).data.orders
        expect(list).toEqual([
          expect.objectContaining({ id: order.id, customer_name: "Ada Obi", email: "buyer@example.com", status: "new", international: true, total: 15000 }),
        ])

        const skip = await api.post(`/sellers/me/orders/${order.id}`, { status: "delivered" }, { headers }).catch((e) => e.response)
        expect(skip.status).toEqual(400)
        expect((await api.post(`/sellers/me/orders/${order.id}`, { status: "shipped" }, { headers })).data.order.status).toEqual("shipped")
        expect((await api.post(`/sellers/me/orders/${order.id}`, { status: "delivered" }, { headers })).data.order.status).toEqual("delivered")
      })

      it("keeps sellers out of each other's products and orders", async () => {
        const a = await signUpSeller("a@example.com", { name: "Shop A" })
        const b = await signUpSeller("b@example.com", { name: "Shop B" })
        const p = (await api.post("/sellers/me/products", { title: "A's bag", price: 100 }, { headers: a.headers })).data.product
        const { result: order } = await placeOrder(a.seller.id, [{ product_id: p.id, quantity: 1 }])

        expect((await api.post(`/sellers/me/products/${p.id}`, { price: 1 }, { headers: b.headers }).catch((e) => e.response)).status).toEqual(404)
        expect((await api.post(`/sellers/me/orders/${order.id}`, { status: "shipped" }, { headers: b.headers }).catch((e) => e.response)).status).toEqual(404)
        expect((await api.get("/sellers/me/orders", { headers: b.headers })).data.orders).toEqual([])
        const { errors } = await createSellerOrderWorkflow(getContainer()).run({
          input: { seller_id: b.seller.id, email: "x@example.com", items: [{ product_id: p.id, quantity: 1 }] },
          throwOnError: false,
        })
        expect(errors[0].error.message).toContain("isn't sold by this store")
      })

      it("leaves cancelled orders out of the totals", async () => {
        const { seller, headers } = await signUpSeller("cancel@example.com", { name: "Cancel Co", country_code: "GH" })
        const p = (await api.post("/sellers/me/products", { title: "Shea", price: 1000 }, { headers })).data.product
        const { result: order } = await placeOrder(seller.id, [{ product_id: p.id, quantity: 1 }])
        await placeOrder(seller.id, [{ product_id: p.id, quantity: 2 }])
        await getContainer().resolve(Modules.ORDER).updateOrders([{ id: order.id, status: "canceled" }])

        const money = (await api.get("/sellers/me/finance?period=all", { headers })).data
        expect(money.totals).toEqual(expect.objectContaining({ orders: 1, revenue: 2000, payment_fees: 39 }))
      })
    })

    describe("owner page", () => {
      it("shows every seller with totals kept per currency, for the AQENORA team only", async () => {
        const ng = await signUpSeller("n@example.com", { name: "Naija Shop", country_code: "NG" })
        const za = await signUpSeller("z@example.com", { name: "Cape Shop", country_code: "ZA" })
        const pn = (await api.post("/sellers/me/products", { title: "Ankara", price: 20000, cost_price: 8000 }, { headers: ng.headers })).data.product
        const pz = (await api.post("/sellers/me/products", { title: "Bowl", price: 500, cost_price: 200 }, { headers: za.headers })).data.product
        await placeOrder(ng.seller.id, [{ product_id: pn.id, quantity: 1 }])
        await placeOrder(za.seller.id, [{ product_id: pz.id, quantity: 2 }])

        expect((await api.get("/admin/finance/sellers").catch((e) => e.response)).status).toEqual(401)
        expect((await api.get("/admin/finance/sellers", { headers: ng.headers }).catch((e) => e.response)).status).toEqual(401)

        const res = (await api.get("/admin/finance/sellers?period=30d", { headers: await adminHeaders() })).data
        expect(res.sellers.map((s: { name: string }) => s.name)).toEqual(["Naija Shop", "Cape Shop"])
        expect(res.sellers[0]).toEqual(expect.objectContaining({ currency_code: "ngn", orders: 1, revenue: 20000, platform_fees: 600, plan: "free" }))
        expect(res.totals_by_currency.map((t: { currency_code: string }) => t.currency_code)).toEqual(["ngn", "zar"])
        expect(res.totals_by_currency[1]).toEqual(expect.objectContaining({ sellers: 1, orders: 1, revenue: 1000, platform_fees: 30 }))
      })
    })
  },
})
