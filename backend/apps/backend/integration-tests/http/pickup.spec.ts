import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createSellerOrderWorkflow } from "../../src/workflows/create-seller-order"

jest.setTimeout(120 * 1000)
const password = "supersecret123"

const open = { open: "09:00", close: "18:00" }
const pickup = {
  enabled: true,
  address: "12 Admiralty Way, Lekki Phase 1",
  area: "Lekki, Lagos",
  hours: { mon: open, tue: open, wed: open, thu: open, fri: open, sat: { open: "10:00", close: "16:00" }, sun: null },
  instructions: "Ask for Ada at the counter.",
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function signUp() {
      const email = "shop@example.com"
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const created = await api.post("/sellers", { name: "Adire House" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const headers = { authorization: `Bearer ${login.data.token}` }
      const product = (await api.post("/sellers/me/products", { title: "Wrap", price: 5000 }, { headers })).data.product
      return { seller: created.data.seller, headers, product }
    }
    type Res = { status: number; data: { message: string } }
    const err = (p: Promise<unknown>): Promise<Res> => p.then(() => ({ status: 200, data: { message: "" } }), (e) => e.response)

    it("saves pickup settings and checks them", async () => {
      const { headers } = await signUp()
      const saved = (await api.post("/sellers/me", { pickup }, { headers })).data.seller.pickup
      expect(saved).toEqual(pickup)

      const bad = async (p: unknown) => (await err(api.post("/sellers/me", { pickup: p }, { headers }))).status
      expect(await bad({ ...pickup, address: "" })).toEqual(400)
      expect(await bad({ ...pickup, hours: { ...pickup.hours, mon: { open: "18:00", close: "09:00" } } })).toEqual(400)
      expect(await bad({ ...pickup, hours: { ...pickup.hours, mon: { open: "9am", close: "5pm" } } })).toEqual(400)
      expect(await bad({ ...pickup, hours: { ...pickup.hours, holiday: open } })).toEqual(400)
      const allClosed = Object.fromEntries(Object.keys(pickup.hours).map((d) => [d, null]))
      expect(await bad({ ...pickup, hours: allClosed })).toEqual(400)
      // Turning pickup off doesn't need an address.
      expect(await bad({ ...pickup, enabled: false, address: "", hours: allClosed })).toEqual(200)
    })

    it("shows pickup on the store only when it's on", async () => {
      const { headers } = await signUp()
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      const h = { headers: { "x-publishable-api-key": key.token } }
      expect((await api.get("/store/sellers/adirehouse", h)).data.store.pickup).toBeNull()
      await api.post("/sellers/me", { pickup }, { headers })
      expect((await api.get("/store/sellers/adirehouse", h)).data.store.pickup).toEqual(pickup)
      await api.post("/sellers/me", { pickup: { ...pickup, enabled: false } }, { headers })
      expect((await api.get("/store/sellers/adirehouse", h)).data.store.pickup).toBeNull()
    })

    it("pickup orders: only if offered, then ready for pickup and picked up", async () => {
      const { seller, headers, product } = await signUp()
      const place = (fulfillment: "pickup" | "delivery") =>
        createSellerOrderWorkflow(getContainer()).run({
          input: { seller_id: seller.id, email: "b@example.com", fulfillment, items: [{ product_id: product.id, quantity: 1 }] },
          throwOnError: false,
        })

      const refused = await place("pickup")
      expect(refused.errors[0].error.message).toContain("doesn't offer pickup")

      await api.post("/sellers/me", { pickup }, { headers })
      const { result: order } = await place("pickup")
      const listed = (await api.get("/sellers/me/orders", { headers })).data.orders[0]
      expect(listed).toEqual(expect.objectContaining({ id: order.id, fulfillment: "pickup", status: "new" }))

      expect((await err(api.post(`/sellers/me/orders/${order.id}`, { status: "shipped" }, { headers }))).status).toEqual(400)
      expect((await api.post(`/sellers/me/orders/${order.id}`, { status: "ready" }, { headers })).data.order.status).toEqual("ready")
      expect((await api.post(`/sellers/me/orders/${order.id}`, { status: "collected" }, { headers })).data.order.status).toEqual("collected")

      const { result: delivery } = await place("delivery")
      expect((await err(api.post(`/sellers/me/orders/${delivery.id}`, { status: "ready" }, { headers }))).status).toEqual(400)
    })
  },
})
