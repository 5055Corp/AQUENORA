import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"

jest.setTimeout(120 * 1000)

const password = "supersecret123"
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).toString("base64")
const PDF = Buffer.from("%PDF-1.4 certificate of incorporation").toString("base64")

beforeAll(() => {
  // Only checked for being set: no Paystack calls happen here.
  process.env.PAYSTACK_SECRET_KEY = "sk_test_verification"
})

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const status = (p: Promise<unknown>) => p.then(() => 200, (e) => e.response.status)

    async function newSeller(email: string, name: string) {
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const { seller } = (await api.post("/sellers", { name }, { headers: { authorization: `Bearer ${reg.data.token}` } })).data
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const sellers = getContainer().resolve("seller") as { updateSellers: (d: unknown) => Promise<unknown> }
      // A bank account is connected, so only verification stands between the shop and payments.
      await sellers.updateSellers({ id: seller.id, paystack_subaccount_code: "ACCT_test" })
      return { seller, headers: { authorization: `Bearer ${login.data.token}` } }
    }
    async function admin() {
      const reg = await api.post("/auth/user/emailpass/register", { email: "owner@aquenora.com", password })
      const authIdentityId = JSON.parse(Buffer.from(reg.data.token.split(".")[1], "base64").toString()).auth_identity_id
      await createUserAccountWorkflow(getContainer()).run({ input: { authIdentityId, userData: { email: "owner@aquenora.com" } } })
      const login = await api.post("/auth/user/emailpass", { email: "owner@aquenora.com", password })
      return { authorization: `Bearer ${login.data.token}` }
    }
    async function store() {
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      return { headers: { "x-publishable-api-key": key.token } }
    }

    it("new sellers can't take payments until AQUENORA approves their documents", async () => {
      const pk = await store()
      const { seller, headers } = await newSeller("new@x.test", "New Shop")
      expect((await api.get("/sellers/me/verification", { headers })).data.verification.status).toBe("unverified")
      expect((await api.get("/store/sellers/newshop", pk)).data.store).toEqual(expect.objectContaining({ accepts_payments: false, verified: false }))

      // Missing pieces are explained.
      const bad = await api.post("/sellers/me/verification", { type: "individual", socials: {}, documents: [{ kind: "id", mime_type: "image/jpeg", data: JPG }] }, { headers }).catch((e) => e.response)
      expect(bad.status).toBe(400)
      expect(bad.data.message).toMatch(/selfie|social|type of ID/)

      // Not registered: ID + selfie + a social handle.
      const sent = (await api.post("/sellers/me/verification", {
        type: "individual", id_type: "nin", socials: { instagram: "@new.shop" },
        documents: [{ kind: "id", mime_type: "image/jpeg", data: JPG }, { kind: "selfie", mime_type: "image/jpeg", data: JPG }],
      }, { headers })).data.verification
      expect(sent.status).toBe("pending")
      expect(sent.details.socials).toEqual({ instagram: "new.shop" })
      expect(sent).not.toHaveProperty("documents")

      // AQUENORA reviews: the list, the private documents, then a rejection with a reason.
      const adminHeaders = await admin()
      expect(await status(api.get("/admin/verifications"))).toBe(401)
      const list = (await api.get("/admin/verifications", { headers: adminHeaders })).data.sellers
      expect(list.map((s: { id: string }) => s.id)).toEqual([seller.id])
      const docs = (await api.get(`/admin/verifications/${seller.id}`, { headers: adminHeaders })).data.documents
      expect(docs.map((d: { kind: string }) => d.kind).sort()).toEqual(["id", "selfie"])
      const file = await api.get(`/admin/verifications/${seller.id}/documents/${docs[0].id}`, { headers: adminHeaders, responseType: "arraybuffer" })
      expect(file.headers["content-type"]).toContain("image/jpeg")
      expect(await status(api.post(`/admin/verifications/${seller.id}`, { decision: "reject" }, { headers: adminHeaders }))).toBe(400)
      await api.post(`/admin/verifications/${seller.id}`, { decision: "reject", reason: "The selfie doesn't match the ID." }, { headers: adminHeaders })
      const rejected = (await api.get("/sellers/me/verification", { headers })).data.verification
      expect(rejected).toEqual(expect.objectContaining({ status: "rejected", details: expect.objectContaining({ reject_reason: "The selfie doesn't match the ID." }) }))

      // Registered business: CAC number + certificate. Then approved: payments switch on.
      await api.post("/sellers/me/verification", {
        type: "registered", business_name: "New Shop Ltd", cac_number: "rc1234567", socials: {},
        documents: [{ kind: "cac", mime_type: "application/pdf", data: PDF }],
      }, { headers })
      await api.post(`/admin/verifications/${seller.id}`, { decision: "approve" }, { headers: adminHeaders })
      expect((await api.get("/sellers/me/verification", { headers })).data.verification.status).toBe("verified")
      expect((await api.get("/store/sellers/newshop", pk)).data.store).toEqual(expect.objectContaining({ accepts_payments: true, verified: true }))
      // Documents from the first try were replaced.
      expect((await api.get(`/admin/verifications/${seller.id}`, { headers: adminHeaders })).data.documents.map((d: { kind: string }) => d.kind)).toEqual(["cac"])

      // The seller was emailed both decisions.
      const sentMail = await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ to: "new@x.test" })
      expect(sentMail).toHaveLength(2)
      expect(await status(api.post("/sellers/me/verification", { type: "registered", business_name: "X", cac_number: "RC1", socials: {}, documents: [{ kind: "cac", mime_type: "application/pdf", data: PDF }] }, { headers }))).toBe(400)
    })
  },
})
