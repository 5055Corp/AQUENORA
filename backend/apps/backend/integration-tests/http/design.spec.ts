import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

const design = {
  version: 1,
  colors: { background: "#16130f", text: "#f6efe4", accent: "#6250d6", accent_text: "#ffffff", card: "#221e19" },
  fonts: { heading: "playfair", body: "poppins" },
  header: { align: "center" },
  banner: { style: "slim", headline: "Made in Lagos", subtext: "Hand-dyed adire, shipped worldwide" },
  products: { columns: 3, show_stock: false },
  shape: { corners: "square", buttons: "rounded" },
  announcement: "Free delivery this week",
  about: "We dye every piece by hand.\nFamily business since 1998.",
  social: { instagram: "@adire.house", whatsapp: "+234 801 234 5678" },
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function signUp() {
      const email = "design@example.com"
      const password = "supersecret123"
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      await api.post("/sellers", { name: "Adire House" }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      return { authorization: `Bearer ${login.data.token}` }
    }

    it("saves a full store design and cleans up social links", async () => {
      const headers = await signUp()
      expect((await api.get("/sellers/me", { headers })).data.seller.design).toBeNull()

      const saved = (await api.post("/sellers/me", { design }, { headers })).data.seller.design
      expect(saved).toEqual({ ...design, social: { instagram: "adire.house", whatsapp: "2348012345678" } })
    })

    it("rejects designs with bad values or unknown settings", async () => {
      const headers = await signUp()
      const bad = async (d: unknown) => (await api.post("/sellers/me", { design: d }, { headers }).catch((e) => e.response)).status

      expect(await bad({ ...design, colors: { ...design.colors, accent: "red" } })).toEqual(400)
      expect(await bad({ ...design, colors: { ...design.colors, accent: "#fff; background:url(x)" } })).toEqual(400)
      expect(await bad({ ...design, fonts: { heading: "comic-sans", body: "poppins" } })).toEqual(400)
      expect(await bad({ ...design, products: { columns: 6, show_stock: true } })).toEqual(400)
      expect(await bad({ ...design, css: "body{}" })).toEqual(400)
      expect(await bad({ ...design, social: { instagram: "<script>", whatsapp: "" } })).toEqual(400)
      expect(await bad({ ...design, about: "x".repeat(601) })).toEqual(400)
    })

    it("shows the design on the public store", async () => {
      const headers = await signUp()
      await api.post("/sellers/me", { design }, { headers })
      const key = await getContainer().resolve(Modules.API_KEY).createApiKeys({ title: "t", type: "publishable", created_by: "t" })
      const res = await api.get("/store/sellers/adirehouse", { headers: { "x-publishable-api-key": key.token } })
      expect(res.data.store.design.banner).toEqual(design.banner)
      expect(res.data.store.design.fonts).toEqual(design.fonts)
    })

    // A real 1x1 PNG.
    const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

    it("uploads a logo and banner photo and saves them in the design", async () => {
      const headers = await signUp()
      const logo = (await api.post("/sellers/me/uploads", { kind: "logo", mime_type: "image/png", data: PNG }, { headers })).data.url
      const banner = (await api.post("/sellers/me/uploads", { kind: "banner", mime_type: "image/png", data: PNG }, { headers })).data.url
      expect(logo).toMatch(/^http:\/\/localhost:\d+\/static\/\d+-sel_[A-Z0-9]+-logo-[0-9a-f]{8}\.png$/)
      expect(banner).not.toEqual(logo)

      const saved = (await api.post("/sellers/me", { design: { ...design, logo, banner: { ...design.banner, image: banner } } }, { headers })).data.seller.design
      expect(saved.logo).toBe(logo)
      expect(saved.banner.image).toBe(banner)

      // Removing them again.
      const cleared = (await api.post("/sellers/me", { design: { ...design, logo: null, banner: { ...design.banner, image: null } } }, { headers })).data.seller.design
      expect(cleared.logo).toBeNull()
    })

    it("refuses files that aren't pictures, other people, and odd image addresses", async () => {
      const headers = await signUp()
      const status = (p: Promise<unknown>) => p.then(() => 200, (e) => e.response.status)
      const notPng = Buffer.from("<script>alert(1)</script>").toString("base64")
      expect(await status(api.post("/sellers/me/uploads", { kind: "logo", mime_type: "image/png", data: notPng }, { headers }))).toBe(400)
      expect(await status(api.post("/sellers/me/uploads", { kind: "logo", mime_type: "image/svg+xml", data: PNG }, { headers }))).toBe(400)
      expect(await status(api.post("/sellers/me/uploads", { kind: "logo", mime_type: "image/png", data: PNG }))).toBe(401)
      expect(await status(api.post("/sellers/me", { design: { ...design, logo: "javascript:alert(1)" } }, { headers }))).toBe(400)
      expect(await status(api.post("/sellers/me", { design: { ...design, logo: 'https://x.test/a.png" onerror="x' } }, { headers }))).toBe(400)
    })
  },
})
