import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

beforeAll(() => {
  // Only checked for being set: no Paystack calls happen in these tests.
  process.env.PAYSTACK_SECRET_KEY = "sk_test_marketplace"
})

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function seller(email: string, name: string, category = "Fashion & clothing") {
      const password = "supersecret123"
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const { seller } = (await api.post("/sellers", { name, category }, { headers: { authorization: `Bearer ${reg.data.token}` } })).data
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const headers = { authorization: `Bearer ${login.data.token}` }
      const photo = async () => (await api.post("/sellers/me/uploads", { kind: "product", mime_type: "image/png", data: PNG }, { headers })).data.url
      const product = async (title: string, opts: { photo?: boolean; stock?: number; description?: string } = {}) =>
        (await api.post("/sellers/me/products", {
          title, price: 10000, stock: opts.stock ?? 3, description: opts.description,
          ...(opts.photo === false ? {} : { images: [await photo()] }),
        }, { headers })).data.product
      const canPay = async () => {
        const sellers = getContainer().resolve("seller") as { updateSellers: (d: unknown) => Promise<unknown> }
        await sellers.updateSellers({ id: seller.id, paystack_subaccount_code: "ACCT_test" })
      }
      return { seller, headers, product, canPay }
    }

    async function store() {
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      return { headers: { "x-publishable-api-key": key.token } }
    }

    it("finds products across stores, grouped by store, with only listed, payable stores and photographed products", async () => {
      const opts = await store()
      const adire = await seller("a@x.test", "Adire House")
      await adire.canPay()
      await adire.product("Indigo adire kimono")
      await adire.product("Adire tote bag")
      await adire.product("Plain shirt", { description: "Cotton, dyed with adire patterns" })
      await adire.product("Adire scarf, no photo", { photo: false })
      await adire.product("Adire fan, sold out", { stock: 0 })

      const kente = await seller("k@x.test", "Kente Kloset")
      await kente.canPay()
      await kente.product("Adire x kente shirt")
      await kente.product("Kente stole")

      // Can't take payments yet: never shown.
      const unpaid = await seller("u@x.test", "Unpaid Adire")
      await unpaid.product("Adire wrap")

      const res = (await api.get("/store/marketplace?q=ADIRE", opts)).data
      expect(res.stores.map((s: { handle: string }) => s.handle)).toEqual(["adirehouse", "kentekloset"])
      const first = res.stores[0]
      expect(first.match_count).toBe(3)
      // Title matches before description matches.
      expect(first.matches.map((m: { title: string }) => m.title).slice(-1)).toEqual(["Plain shirt"])
      expect(first.matches[0].image).toMatch(/\/static\//)
      expect(first).not.toHaveProperty("paystack_subaccount_code")
      expect(res.total_products).toBe(4)

      // Every word must match.
      expect((await api.get("/store/marketplace?q=kente%20stole", opts)).data.stores.map((s: { handle: string }) => s.handle)).toEqual(["kentekloset"])
      expect((await api.get("/store/marketplace?q=zzz", opts)).data.stores).toEqual([])

      // A seller can hide their store from search.
      await api.post("/sellers/me", { marketplace_listed: false }, { headers: kente.headers })
      expect((await api.get("/store/marketplace?q=adire", opts)).data.stores.map((s: { handle: string }) => s.handle)).toEqual(["adirehouse"])

      const home = (await api.get("/store/marketplace/home", opts)).data
      expect(home.categories).toEqual([{ name: "Fashion & clothing", count: 1 }])
      expect(home.featured.map((s: { handle: string }) => s.handle)).toEqual(["adirehouse"])
      expect(home.trending.length).toBeGreaterThan(0)
      expect(home.trending[0].store).toEqual({ handle: "adirehouse", name: "Adire House" })

      const status = (p: Promise<unknown>) => p.then(() => 200, (e) => e.response.status)
      expect(await status(api.get("/store/marketplace", opts))).toBe(400)
      expect(await status(api.get(`/store/marketplace?q=${"a".repeat(81)}`, opts))).toBe(400)
    })
    it("tells sellers outside Nigeria that payouts are coming soon", async () => {
      const password = "supersecret123"
      const reg = await api.post("/auth/seller/emailpass/register", { email: "gh@x.test", password })
      await api.post("/sellers", { name: "Accra Threads", country_code: "GH" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email: "gh@x.test", password })
      const res = await api
        .post("/sellers/me/payouts", { bank_code: "GH001", account_number: "1234567890" }, { headers: { authorization: `Bearer ${login.data.token}` } })
        .catch((e) => e.response)
      expect(res.status).toBe(400)
      expect(res.data.message).toContain("coming soon")
    })
  },
})
