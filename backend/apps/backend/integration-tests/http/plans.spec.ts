import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"
import { createSellerOrderWorkflow } from "../../src/workflows/create-seller-order"
import { SELLER_MODULE } from "../../src/modules/seller"
import type SellerModuleService from "../../src/modules/seller/service"

jest.setTimeout(120 * 1000)
const password = "supersecret123"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function signUp(email: string, name: string, country_code = "NG") {
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const created = await api.post("/sellers", { name, country_code }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const headers = { authorization: `Bearer ${login.data.token}` }
      const product = (await api.post("/sellers/me/products", { title: "Wrap", price: 10000, cost_price: 4000 }, { headers })).data.product
      return { seller: created.data.seller, headers, product }
    }
    async function admin() {
      const reg = await api.post("/auth/user/emailpass/register", { email: "owner@aquenora.com", password })
      const authIdentityId = JSON.parse(Buffer.from(reg.data.token.split(".")[1], "base64").toString()).auth_identity_id
      await createUserAccountWorkflow(getContainer()).run({ input: { authIdentityId, userData: { email: "owner@aquenora.com" } } })
      const login = await api.post("/auth/user/emailpass", { email: "owner@aquenora.com", password })
      return { authorization: `Bearer ${login.data.token}` }
    }
    const buy = (seller_id: string, product_id: string, email = "b@example.com") =>
      createSellerOrderWorkflow(getContainer()).run({ input: { seller_id, email, marketing_opt_in: true, items: [{ product_id, quantity: 1 }] } })
    type ErrorResponse = { status: number; data: { message: string } }
    const err = (p: Promise<unknown>): Promise<ErrorResponse> => p.then(() => ({ status: 200, data: { message: "" } }), (e) => e.response)

    it("starts on Free: 3% per sale, badge, totals only, weekly campaigns, no own domain", async () => {
      const s = await signUp("free@example.com", "Free Shop")
      const plan = (await api.get("/sellers/me/plan", { headers: s.headers })).data
      expect(plan.plan).toEqual(expect.objectContaining({ plan: "free", status: "free", show_badge: true, commission_percent: 3, trial_used: false }))
      expect(plan.price).toEqual({ currency_code: "ngn", monthly_price: 38500 })
      expect(plan.buy_domain_url).toContain("namecheap.com")

      await buy(s.seller.id, s.product.id)
      const money = (await api.get("/sellers/me/finance?period=all", { headers: s.headers })).data
      expect(money.locked).toBe(true)
      expect(money.series).toEqual([])
      expect(money.by_product).toEqual([])
      expect(money.totals).toEqual(expect.objectContaining({ revenue: 10000, platform_fees: 300 }))

      await api.post("/sellers/me/campaigns", { audience: "all", subject: "Hi", message: "Hello" }, { headers: s.headers })
      const second = await err(api.post("/sellers/me/campaigns", { audience: "all", subject: "Hi", message: "Again" }, { headers: s.headers }))
      expect(second.status).toEqual(400)
      expect(second.data.message).toContain("one campaign a week")

      const domain = await err(api.post("/sellers/me/domain", { domain: "freeshop.com" }, { headers: s.headers }))
      expect(domain.status).toEqual(400)
      expect(domain.data.message).toContain("Pro feature")

      const pub = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      expect((await api.get("/store/sellers/freeshop", { headers: { "x-publishable-api-key": pub.token } })).data.store.show_badge).toBe(true)
    })

    it("trial: Pro features for 14 days, 1% on new orders, badge stays, only once", async () => {
      const s = await signUp("trial@example.com", "Trial Shop")
      await buy(s.seller.id, s.product.id) // before the trial: 3%
      const plan = (await api.post("/sellers/me/plan/trial", {}, { headers: s.headers })).data.plan
      expect(plan).toEqual(expect.objectContaining({ plan: "pro", status: "trial", show_badge: true, commission_percent: 1, trial_used: true }))
      const days = (new Date(plan.trial_ends_at).getTime() - Date.now()) / 86400000
      expect(Math.round(days)).toEqual(14)
      expect((await err(api.post("/sellers/me/plan/trial", {}, { headers: s.headers }))).data.message).toContain("already been used")

      await buy(s.seller.id, s.product.id) // during the trial: 1%
      const money = (await api.get("/sellers/me/finance?period=all", { headers: s.headers })).data
      expect(money.locked).toBe(false)
      expect(money.by_product).toHaveLength(1)
      expect(money.totals.platform_fees).toEqual(300 + 100)
    })

    it("connects an own domain on Pro and serves it once verified", async () => {
      const s = await signUp("dom@example.com", "Adire House")
      await api.post("/sellers/me/plan/trial", {}, { headers: s.headers })

      expect((await err(api.post("/sellers/me/domain", { domain: "not a domain" }, { headers: s.headers }))).status).toEqual(400)
      expect((await err(api.post("/sellers/me/domain", { domain: "shop.aquenora.com" }, { headers: s.headers }))).status).toEqual(400)
      const set = (await api.post("/sellers/me/domain", { domain: "https://www.AdireHouse.com/" }, { headers: s.headers })).data
      expect(set.domain).toEqual(expect.objectContaining({ name: "adirehouse.com", connected: false }))
      expect(set.domain.records[0]).toEqual(expect.objectContaining({ type: "CNAME", host: "www" }))

      const other = await signUp("dom2@example.com", "Copy Shop")
      await api.post("/sellers/me/plan/trial", {}, { headers: other.headers })
      expect((await err(api.post("/sellers/me/domain", { domain: "adirehouse.com" }, { headers: other.headers }))).status).toEqual(422)

      const pub = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      const h = { headers: { "x-publishable-api-key": pub.token } }
      expect((await err(api.get("/store/domains/adirehouse.com", h))).status).toEqual(404)
      // DNS can't be reached from tests, so mark it verified as the check would.
      const sellers: SellerModuleService = getContainer().resolve(SELLER_MODULE)
      await sellers.updateSellers({ id: s.seller.id, domain_verified_at: new Date() })
      expect((await api.get("/store/domains/www.adirehouse.com", h)).data).toEqual({ handle: "adirehouse" })

      await api.delete("/sellers/me/domain", { headers: s.headers })
      expect((await err(api.get("/store/domains/adirehouse.com", h))).status).toEqual(404)
    })

    it("lets the AQUENORA team set prices per country, rates and trial length, and mark sellers paid", async () => {
      const s = await signUp("gh@example.com", "Accra Art", "GH")
      const headers = await admin()

      expect((await err(api.get("/admin/billing/prices"))).status).toEqual(401)
      const prices = (await api.get("/admin/billing/prices", { headers })).data.prices
      expect(prices.find((p: { country_code: string }) => p.country_code === "GH")).toEqual({ country_code: "GH", currency_code: "ghs", monthly_price: 375, is_default: true })

      await api.post("/admin/billing/prices", { prices: [{ country_code: "GH", monthly_price: 399 }] }, { headers })
      expect((await api.get("/sellers/me/plan", { headers: s.headers })).data.price).toEqual({ currency_code: "ghs", monthly_price: 399 })
      expect((await err(api.post("/admin/billing/prices", { prices: [{ country_code: "XX", monthly_price: 1 }] }, { headers }))).status).toEqual(400)

      await api.post("/admin/billing/settings", { free_commission_percent: 2.5, trial_days: 30 }, { headers })
      expect((await api.get("/sellers/me/plan", { headers: s.headers })).data.plan.commission_percent).toEqual(2.5)

      const paid = (await api.post(`/admin/billing/sellers/${s.seller.id}/paid`, { months: 1 }, { headers })).data
      expect(new Date(paid.pro_paid_until).getTime()).toBeGreaterThan(Date.now() + 27 * 86400000)
      const plan = (await api.get("/sellers/me/plan", { headers: s.headers })).data.plan
      expect(plan).toEqual(expect.objectContaining({ plan: "pro", status: "paid", show_badge: false, commission_percent: 1 }))

      const finance = (await api.get("/admin/finance/sellers", { headers })).data.sellers[0]
      expect(finance).toEqual(expect.objectContaining({ plan: "pro", plan_status: "paid", commission_percent: 1 }))

      const upgrade = await api.post("/sellers/me/plan/upgrade", {}, { headers: s.headers })
      expect(upgrade.status).toEqual(202)
      expect(upgrade.data.payment).toEqual("manual")
    })
  },
})
