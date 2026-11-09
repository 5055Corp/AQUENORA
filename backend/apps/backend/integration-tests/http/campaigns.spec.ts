import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { createSellerOrderWorkflow } from "../../src/workflows/create-seller-order"

jest.setTimeout(120 * 1000)

const password = "supersecret123"

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    async function signUpSeller(email: string, name: string) {
      const reg = await api.post("/auth/seller/emailpass/register", { email, password })
      const created = await api.post("/sellers", { name }, { headers: { authorization: `Bearer ${reg.data.token}` } })
      const login = await api.post("/auth/seller/emailpass", { email, password })
      const headers = { authorization: `Bearer ${login.data.token}` }
      const product = (await api.post("/sellers/me/products", { title: "Wrap", price: 5000 }, { headers })).data.product
      return { seller: created.data.seller, headers, product }
    }

    const buy = (seller_id: string, product_id: string, email: string, customer_name: string, marketing_opt_in: boolean) =>
      createSellerOrderWorkflow(getContainer()).run({
        input: { seller_id, email, customer_name, marketing_opt_in, items: [{ product_id, quantity: 1 }] },
      })

    async function shopWithBuyers() {
      const shop = await signUpSeller("shop@example.com", "Adire House")
      await buy(shop.seller.id, shop.product.id, "ada@example.com", "Ada Obi", true)
      await buy(shop.seller.id, shop.product.id, "ADA@example.com", "Ada Obi", false) // repeat buyer; no "yes" this time
      await buy(shop.seller.id, shop.product.id, "kofi@example.com", "Kofi Mensah", true)
      await buy(shop.seller.id, shop.product.id, "zola@example.com", "Zola Dube", false) // never said yes
      return shop
    }

    it("lists past buyers with their email permission and group sizes", async () => {
      const shop = await shopWithBuyers()
      const res = (await api.get("/sellers/me/customers", { headers: shop.headers })).data
      expect(res.count).toEqual(3)
      const ada = res.customers.find((c: { email: string }) => c.email === "ada@example.com")
      expect(ada).toEqual(expect.objectContaining({ name: "Ada Obi", orders: 2, total_spent: 10000, subscribed: true }))
      expect(res.customers.find((c: { email: string }) => c.email === "zola@example.com").subscribed).toBe(false)
      expect(res.audiences).toEqual({ all: 2, repeat: 1, lapsed: 0 })

      const other = await signUpSeller("other@example.com", "Other Shop")
      expect((await api.get("/sellers/me/customers", { headers: other.headers })).data.customers).toEqual([])
    })

    it("emails only buyers who said yes, personalised, with an unsubscribe link, once a day", async () => {
      const shop = await shopWithBuyers()
      const sent = await api.post(
        "/sellers/me/campaigns",
        { audience: "all", subject: "New wraps for you, {name}", message: "Hi {name},\n\nNew <b>indigo</b> wraps just landed." },
        { headers: shop.headers }
      )
      expect(sent.status).toEqual(201)
      expect(sent.data.campaign).toEqual(expect.objectContaining({ audience: "all", recipient_count: 2, sent_count: 2, failed_count: 0 }))

      const notifications = await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ resource_id: sent.data.campaign.id })
      expect(notifications.map((n) => n.to).sort()).toEqual(["ada@example.com", "kofi@example.com"])
      const toAda = notifications.find((n) => n.to === "ada@example.com")!
      const data = toAda.data as { subject: string; html: string; text: string; headers: Record<string, string> }
      expect(data.subject).toEqual("New wraps for you, Ada")
      expect(data.html).toContain("Hi Ada,")
      expect(data.html).toContain("&lt;b&gt;indigo&lt;/b&gt;") // the seller's text is shown, never run as HTML
      expect(data.headers["List-Unsubscribe"]).toMatch(/\/marketing\/unsubscribe\/[\w-]+>$/)
      expect(data.text).toContain("Unsubscribe: ")

      const again = await api
        .post("/sellers/me/campaigns", { audience: "all", subject: "Again", message: "Hi" }, { headers: shop.headers })
        .catch((e) => e.response)
      expect(again.status).toEqual(400)
      expect(again.data.message).toContain("last 24 hours")

      const list = (await api.get("/sellers/me/campaigns", { headers: shop.headers })).data.campaigns
      expect(list).toHaveLength(1)
    })

    it("refuses a group with nobody in it", async () => {
      const shop = await signUpSeller("solo@example.com", "Solo Shop")
      await buy(shop.seller.id, shop.product.id, "once@example.com", "One Time", true)
      const res = await api
        .post("/sellers/me/campaigns", { audience: "repeat", subject: "Hi", message: "Hi" }, { headers: shop.headers })
        .catch((e) => e.response)
      expect(res.status).toEqual(400)
      expect(res.data.message).toContain("No customers in this group")
    })

    it("unsubscribes from the link, and a later order without a yes doesn't sign them back up", async () => {
      const shop = await shopWithBuyers()
      await api.post("/sellers/me/campaigns", { audience: "all", subject: "Hi", message: "Hello" }, { headers: shop.headers })
      const [n] = await getContainer().resolve(Modules.NOTIFICATION).listNotifications({ to: "kofi@example.com" })
      const path = new URL((n.data as { headers: Record<string, string> }).headers["List-Unsubscribe"].slice(1, -1)).pathname

      const confirm = await api.get(path)
      expect(confirm.status).toEqual(200)
      expect(confirm.data).toContain("Stop emails from Adire House?")
      expect((await api.post(path)).data).toContain("You're unsubscribed")
      expect((await api.get(path)).data).toContain("already unsubscribed")
      expect((await api.get("/marketing/unsubscribe/not-a-real-token").catch((e) => e.response)).status).toEqual(404)

      const kofi = async () =>
        (await api.get("/sellers/me/customers", { headers: shop.headers })).data.customers.find((c: { email: string }) => c.email === "kofi@example.com")
      expect((await kofi()).subscribed).toBe(false)
      await buy(shop.seller.id, shop.product.id, "kofi@example.com", "Kofi Mensah", false)
      expect((await kofi()).subscribed).toBe(false)
      await buy(shop.seller.id, shop.product.id, "kofi@example.com", "Kofi Mensah", true)
      expect((await kofi()).subscribed).toBe(true)
    })

    it("checks campaign input", async () => {
      const shop = await shopWithBuyers()
      const res = await api
        .post("/sellers/me/campaigns", { audience: "everyone", subject: "", message: "Hi" }, { headers: shop.headers })
        .catch((e) => e.response)
      expect(res.status).toEqual(400)
      expect((await api.get("/sellers/me/customers").catch((e) => e.response)).status).toEqual(401)
    })
  },
})
