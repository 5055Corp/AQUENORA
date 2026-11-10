import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

const password = "supersecret123"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    /** Registers a seller login and creates its store; returns an auth header for later calls. */
    async function signUpSeller(email: string, body: Record<string, unknown>) {
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const registerToken = reg.data.token as string

      const created = await api.post("/sellers", body, {
        headers: { authorization: `Bearer ${registerToken}` },
      })

      // The register token was issued before the store existed; log in again to get one that carries the seller id.
      const login = await api.post("/auth/seller/emailpass", { email, password })
      return {
        seller: created.data.seller,
        headers: { authorization: `Bearer ${login.data.token}` },
      }
    }

    describe("seller sign-up and store details", () => {
      it("creates a store with a handle and currency from the country", async () => {
        const { seller, headers } = await signUpSeller("ama@example.com", {
          name: "Kente Kloset",
          category: "Fashion & clothing",
          country_code: "GH",
        })

        expect(seller).toEqual(
          expect.objectContaining({
            email: "ama@example.com",
            name: "Kente Kloset",
            handle: "kentekloset",
            country_code: "GH",
            currency_code: "ghs",
            sells_abroad: true,
            theme: "harmattan",
            onboarding_completed: false,
          })
        )

        const me = await api.get("/sellers/me", { headers })
        expect(me.data.seller.id).toEqual(seller.id)
      })

      it("rejects a second store with the same web address", async () => {
        await signUpSeller("one@example.com", { name: "Adire House" })
        const reg = await api.post("/auth/seller/emailpass/register", {
          email: "two@example.com",
          password,
        })
        const err = await api
          .post("/sellers", { name: "Adire  House!" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
          .catch((e) => e.response)
        expect(err.status).toEqual(422)
        expect(err.data.message).toContain("adirehouse.aqenora.com is already taken")
      })

      it("refuses web addresses AQENORA uses itself", async () => {
        const reg = await api.post("/auth/seller/emailpass/register", { email: "res@example.com", password })
        const res = await api
          .post("/sellers", { name: "App" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
          .catch((e) => e.response)
        expect(res.status).toEqual(422)
        expect(res.data.message).toContain("reserved for AQENORA")
      })

      it("blocks the seller API without a seller login", async () => {
        const err = await api.get("/sellers/me").catch((e) => e.response)
        expect(err.status).toEqual(401)
      })

      it("updates the store design and onboarding progress", async () => {
        const { headers } = await signUpSeller("design@example.com", { name: "Lagos Looks" })
        const res = await api.post(
          "/sellers/me",
          { theme: "lagos", accent: "indigo", font: "friendly", announcement: "Free delivery", onboarding_completed: true },
          { headers }
        )
        expect(res.data.seller).toEqual(
          expect.objectContaining({
            theme: "lagos",
            accent: "indigo",
            font: "friendly",
            announcement: "Free delivery",
            onboarding_completed: true,
          })
        )
      })

      it("rejects invalid design values", async () => {
        const { headers } = await signUpSeller("bad@example.com", { name: "Bad Values" })
        const err = await api.post("/sellers/me", { theme: "neon" }, { headers }).catch((e) => e.response)
        expect(err.status).toEqual(400)
      })
    })

    describe("seller products", () => {
      it("adds products in the seller's currency and lists only their own", async () => {
        const a = await signUpSeller("a@example.com", { name: "Adire House", country_code: "NG" })
        const b = await signUpSeller("b@example.com", { name: "Cape Crafts", country_code: "ZA" })

        const created = await api.post(
          "/sellers/me/products",
          { title: "Indigo adire kimono", price: 28000, stock: 6 },
          { headers: a.headers }
        )
        expect(created.status).toEqual(201)
        expect(created.data.product).toEqual(
          expect.objectContaining({ title: "Indigo adire kimono", price: 28000, currency_code: "ngn", stock: 6, status: "published" })
        )

        await api.post("/sellers/me/products", { title: "Beaded bowl", price: 450 }, { headers: b.headers })

        const listA = await api.get("/sellers/me/products", { headers: a.headers })
        expect(listA.data.products.map((p: { title: string }) => p.title)).toEqual(["Indigo adire kimono"])

        const listB = await api.get("/sellers/me/products", { headers: b.headers })
        expect(listB.data.products[0]).toEqual(expect.objectContaining({ title: "Beaded bowl", currency_code: "zar", stock: 1 }))
      })

      it("won't change country once products exist", async () => {
        const { headers } = await signUpSeller("c@example.com", { name: "Accra Art", country_code: "GH" })
        await api.post("/sellers/me/products", { title: "Painting", price: 900 }, { headers })
        const err = await api.post("/sellers/me", { country_code: "NG" }, { headers }).catch((e) => e.response)
        expect(err.status).toEqual(400)
        expect(err.data.message).toContain("can't change your country")
      })
    })

    describe("public storefront data", () => {
      it("returns a store and its products by web address", async () => {
        const apiKeys = getContainer().resolve(Modules.API_KEY)
        const key = await apiKeys.createApiKeys({ title: "test", type: "publishable", created_by: "test" })

        const { headers } = await signUpSeller("shop@example.com", { name: "Adire House" })
        await api.post("/sellers/me/products", { title: "Adire tote bag", price: 24000 }, { headers })

        const res = await api.get("/store/sellers/adirehouse", { headers: { "x-publishable-api-key": key.token } })
        expect(res.data.store).toEqual(expect.objectContaining({ name: "Adire House", currency_code: "ngn" }))
        expect(res.data.store.email).toBeUndefined()
        expect(res.data.products.map((p: { title: string }) => p.title)).toEqual(["Adire tote bag"])

        const missing = await api
          .get("/store/sellers/nope", { headers: { "x-publishable-api-key": key.token } })
          .catch((e) => e.response)
        expect(missing.status).toEqual(404)
      })
    })
  },
})
