import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

const password = "supersecret123"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function storeKey() {
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      return key.token
    }

    /** Logs in to shopping, creating the shopper profile the first time (same email+password as selling). */
    async function shopperLogin(email: string, pk: string, pw = password) {
      const first = await api.post("/auth/customer/emailpass", { email, password: pw })
      let token = first.data.token as string
      const headers = () => ({ authorization: `Bearer ${token}`, "x-publishable-api-key": pk })
      const me = await api.get("/store/customers/me", { headers: headers() }).catch((e) => e.response)
      if (me.status !== 200) {
        await api.post("/store/customers", { email, first_name: "Amaka", last_name: "Obi" }, { headers: headers() })
        token = (await api.post("/auth/customer/emailpass", { email, password: pw })).data.token
      }
      return headers()
    }

    it("lets one AQUENORA login shop and sell, and lists the shopper's orders from every store", async () => {
      const pk = await storeKey()
      // A seller...
      const reg = await api.post("/auth/seller/emailpass/register", { email: "amaka@x.test", password })
      const { seller } = (await api.post("/sellers", { name: "Ada Fabrics" }, { headers: { authorization: `Bearer ${reg.data.token}` } })).data

      // ...logs in to shopping with the same email and password.
      const headers = await shopperLogin("amaka@x.test", pk)
      const me = (await api.get("/store/customers/me", { headers })).data.customer
      expect(me.email).toBe("amaka@x.test")
      // The seller login still works.
      expect((await api.post("/auth/seller/emailpass", { email: "amaka@x.test", password })).status).toBe(200)

      // An order she paid for at another store (made directly here; checkout has its own tests).
      const orders = getContainer().resolve(Modules.ORDER)
      const [order] = await orders.createOrders([{
        email: "amaka@x.test", currency_code: "ngn", metadata: { seller_status: "shipped" },
        items: [{ title: "Indigo adire kimono", quantity: 1, unit_price: 45000 }],
      }])
      await getContainer().resolve(ContainerRegistrationKeys.LINK).create({ seller: { seller_id: seller.id }, [Modules.ORDER]: { order_id: order.id } })
      // Someone else's order isn't shown.
      await orders.createOrders([{ email: "other@x.test", currency_code: "ngn", items: [{ title: "Wrap", quantity: 1, unit_price: 9000 }] }])

      const list = (await api.get("/store/me/orders", { headers })).data.orders
      expect(list).toHaveLength(1)
      expect(list[0]).toEqual(expect.objectContaining({
        store: { name: "Ada Fabrics", handle: "adafabrics" }, status: "shipped", total: 45000,
        items: [expect.objectContaining({ title: "Indigo adire kimono", quantity: 1 })],
      }))
      expect((await api.get("/store/me/orders", { headers: { "x-publishable-api-key": pk } }).catch((e) => e.response)).status).toBe(401)
    })

    it("emails a password reset link that sets a new password for shopping and selling", async () => {
      const pk = await storeKey()
      const reg = await api.post("/auth/seller/emailpass/register", { email: "reset@x.test", password })
      await api.post("/sellers", { name: "Reset Shop" }, { headers: { authorization: `Bearer ${reg.data.token}` } })

      await api.post("/auth/customer/emailpass/reset-password", { identifier: "reset@x.test" })
      // The email goes out from a background subscriber.
      const notifications = getContainer().resolve(Modules.NOTIFICATION)
      let sent: { data?: Record<string, unknown> | null }[] = []
      for (let i = 0; i < 40 && !sent.length; i++) {
        await new Promise((r) => setTimeout(r, 100))
        sent = await notifications.listNotifications({ to: "reset@x.test" })
      }
      expect(sent).toHaveLength(1)
      const text = String(sent[0].data?.text)
      const link = new URL(text.match(/https?:\/\/\S+/)![0])
      expect(link.pathname).toBe("/reset-password")
      expect(link.searchParams.get("email")).toBe("reset@x.test")

      await api.post("/auth/customer/emailpass/update", { password: "brandnew12345" }, { headers: { authorization: `Bearer ${link.searchParams.get("token")}` } })
      expect((await api.post("/auth/seller/emailpass", { email: "reset@x.test", password: "brandnew12345" })).status).toBe(200)
      await shopperLogin("reset@x.test", pk, "brandnew12345")
      expect((await api.post("/auth/seller/emailpass", { email: "reset@x.test", password }).catch((e) => e.response)).status).toBe(401)
    })
  },
})
