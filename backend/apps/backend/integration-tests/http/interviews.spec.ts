import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createUserAccountWorkflow } from "@medusajs/medusa/core-flows"

jest.setTimeout(120 * 1000)
const password = "supersecret123"

const answers = (challenges: string[], extra: Record<string, unknown>[] = []) => [
  { id: "country", section: "About you", question: "Where is your business based?", answer: ["Nigeria"] },
  { id: "sell_where", section: "How you sell", question: "Where do you sell today?", answer: ["WhatsApp", "Instagram"] },
  { id: "challenges", section: "Challenges", question: "Your biggest challenges", answer: challenges },
  { id: "one_problem", section: "Challenges", question: "The one problem to solve", answer: 'Confirming "transfers" takes hours\n=SUM(A1)' },
  ...extra,
]

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    let store: { headers: Record<string, string> }
    beforeEach(async () => {
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      store = { headers: { "x-publishable-api-key": key.token } }
    })
    async function admin() {
      const reg = await api.post("/auth/user/emailpass/register", { email: "owner@aquenora.com", password })
      const authIdentityId = JSON.parse(Buffer.from(reg.data.token.split(".")[1], "base64").toString()).auth_identity_id
      await createUserAccountWorkflow(getContainer()).run({ input: { authIdentityId, userData: { email: "owner@aquenora.com" } } })
      const login = await api.post("/auth/user/emailpass", { email: "owner@aquenora.com", password })
      return { authorization: `Bearer ${login.data.token}` }
    }
    const status = (p: Promise<unknown>) => p.then(() => 200, (e) => e.response.status)

    it("saves answers, keeps contact details only with consent, and summarises them for the admin", async () => {
      await api.post("/store/interviews", {
        version: "1", answers: answers(["Getting new customers", "Confirming payments"]),
        name: "Ada", phone: "+2348012345678", contact_ok: true, wants_early_access: true, country: "Nigeria", source: "whatsapp",
      }, store)
      await api.post("/store/interviews", {
        version: "1", answers: answers(["Confirming payments"]), name: "Kofi", email: "kofi@example.com", contact_ok: false, country: "Ghana",
      }, store)
      // A bot that fills the hidden field: accepted silently, not saved.
      await api.post("/store/interviews", { version: "1", answers: answers(["Spam"]), website: "http://spam.test" }, store)

      expect(await status(api.post("/store/interviews", { version: "1", answers: [] }, store))).toBe(400)
      expect(await status(api.post("/store/interviews", { version: "1", answers: answers(["x"]) }))).toBe(400) // no publishable key
      expect(await status(api.get("/admin/interviews"))).toBe(401)

      const headers = await admin()
      const data = (await api.get("/admin/interviews", { headers })).data
      expect(data.count).toBe(2)
      expect(data.early_access).toBe(1)
      const kofi = data.interviews.find((i: { country: string }) => i.country === "Ghana")
      expect(kofi).toMatchObject({ name: null, email: null, contact_ok: false }) // no consent: contact dropped
      const ada = data.interviews.find((i: { country: string }) => i.country === "Nigeria")
      expect(ada).toMatchObject({ name: "Ada", phone: "+2348012345678", source: "whatsapp", wants_early_access: true })
      const challenges = data.summary.find((s: { id: string }) => s.id === "challenges")
      expect(challenges.choices[0]).toEqual({ choice: "Confirming payments", count: 2 })

      const csv = await api.get("/admin/interviews?format=csv", { headers })
      expect(csv.headers["content-type"]).toContain("text/csv")
      const text: string = csv.data
      expect(text).toContain('"Where do you sell today?"')
      expect(text).toContain('"WhatsApp; Instagram"')
      expect(text).toContain('Confirming ""transfers"" takes hours')
      expect(text).not.toMatch(/"\n?=SUM/) // formulas are neutralised
    })
  },
})
