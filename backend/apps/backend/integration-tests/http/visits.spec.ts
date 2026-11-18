import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)
const password = "supersecret123"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    it("counts store visits by source, with no visitor details", async () => {
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      const pk = { headers: { "x-publishable-api-key": key.token } }
      const reg = await api.post("/auth/seller/emailpass/register", { email: "v@example.com", password })
      await api.post("/sellers", { name: "Adire House" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email: "v@example.com", password })
      const headers = { authorization: `Bearer ${login.data.token}` }

      for (const source of ["whatsapp", "whatsapp", "instagram", "direct"]) {
        expect((await api.post("/store/sellers/adirehouse/visit", { source }, pk)).status).toBe(204)
      }
      // Unknown stores and sources: no error that reveals anything, or a 400 for bad input.
      expect((await api.post("/store/sellers/nope/visit", { source: "whatsapp" }, pk)).status).toBe(204)
      expect((await api.post("/store/sellers/adirehouse/visit", { source: "spam" }, pk).catch((e) => e.response)).status).toBe(400)

      const { visits } = (await api.get("/sellers/me/visits", { headers })).data
      expect(visits.week).toBe(4)
      expect(visits.previous_week).toBe(0)
      expect(visits.by_day).toHaveLength(7)
      expect(visits.by_day[6]).toBe(4)
      expect(visits.sources).toEqual({ whatsapp: 2, instagram: 1, direct: 1 })
      expect((await api.get("/sellers/me/visits").catch((e) => e.response)).status).toBe(401)
    })
  },
})
