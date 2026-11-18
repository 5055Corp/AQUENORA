import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

const password = "supersecret123"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function signUpSeller(email: string, name: string) {
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      await api.post("/sellers", { name, country_code: "NG" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      return { authorization: `Bearer ${login.data.token}` }
    }

    it("sellers can edit, sell out and delete their own products", async () => {
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      const pk = { headers: { "x-publishable-api-key": key.token } }
      const a = await signUpSeller("a@example.com", "Adire House")
      const b = await signUpSeller("b@example.com", "Other Shop")

      const { product } = (await api.post("/sellers/me/products", { title: "Kimono", price: 20000, stock: 4, description: "Hand dyed." }, { headers: a })).data
      const keep = (await api.post("/sellers/me/products", { title: "Tote bag", price: 9000, stock: 2 }, { headers: a })).data.product

      // Edit everything at once.
      const edited = (await api.post(`/sellers/me/products/${product.id}`, { title: "Indigo kimono", description: "Hand dyed in Abeokuta.", price: 28000, stock: 6 }, { headers: a })).data.product
      expect(edited).toEqual(expect.objectContaining({ title: "Indigo kimono", description: "Hand dyed in Abeokuta.", price: 28000, stock: 6 }))
      // An empty description clears it.
      expect((await api.post(`/sellers/me/products/${product.id}`, { description: "" }, { headers: a })).data.product.description).toBeNull()
      // Sold out = stock 0.
      expect((await api.post(`/sellers/me/products/${product.id}`, { stock: 0 }, { headers: a })).data.product.stock).toBe(0)

      // Someone else can't edit or delete it.
      expect((await api.post(`/sellers/me/products/${product.id}`, { title: "Mine" }, { headers: b }).catch((e) => e.response)).status).toBe(404)
      expect((await api.delete(`/sellers/me/products/${product.id}`, { headers: b }).catch((e) => e.response)).status).toBe(404)

      // Delete: gone from the seller's list and the public store; the other product stays.
      expect((await api.delete(`/sellers/me/products/${product.id}`, { headers: a })).data).toEqual({ id: product.id, deleted: true })
      expect((await api.get("/sellers/me/products", { headers: a })).data.products.map((p: { id: string }) => p.id)).toEqual([keep.id])
      expect((await api.get("/store/sellers/adirehouse", pk)).data.products.map((p: { title: string }) => p.title)).toEqual(["Tote bag"])
      // Deleting twice is a 404, not a crash.
      expect((await api.delete(`/sellers/me/products/${product.id}`, { headers: a }).catch((e) => e.response)).status).toBe(404)
    })
  },
})
