import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { createSellerWorkflow } from "../workflows/create-seller"
import { createSellerOrderWorkflow } from "../workflows/create-seller-order"
import { createSellerProductWorkflow } from "../workflows/create-seller-product"

/**
 * Creates the demo seller from the prototype ("Adire House", Nigeria) with a login and four products.
 * Run: npx medusa exec ./src/scripts/seed-aquenora-demo.ts
 * Safe to run twice: it stops if the store already exists.
 */
export default async function seedAquenoraDemo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const auth = container.resolve(Modules.AUTH)

  const email = "demo@aquenora.com"
  const password = "aquenora-demo"

  // The store page (app/store.html) needs this key in VITE_MEDUSA_PUBLISHABLE_KEY.
  const apiKeys = container.resolve(Modules.API_KEY)
  const publishable = (await apiKeys.listApiKeys({ type: "publishable" })).find((k) => !k.revoked_at)
  if (publishable) {
    logger.info(`Publishable API key for the store page: VITE_MEDUSA_PUBLISHABLE_KEY=${publishable.token}`)
  }

  const [existing] = await sellers.listSellers({ handle: "adirehouse" }, { take: 1 })
  if (existing) {
    logger.info("Demo store adirehouse already exists.")
    await addSampleOrders(container, existing.id)
    return
  }

  const { success, authIdentity, error } = await auth.register("emailpass", {
    body: { email, password },
  } as Parameters<typeof auth.register>[1])
  if (!success || !authIdentity) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Could not create the demo login: ${error}`)
  }

  const { result: seller } = await createSellerWorkflow(container).run({
    input: {
      auth_identity_id: authIdentity.id,
      seller: { email, name: "Adire House", category: "Fashion & clothing", country_code: "NG" },
    },
  })

  // Prices in whole naira (the store's currency), e.g. 28000 = NGN 28,000.
  const products = [
    { title: "Indigo adire kimono", naira: 28000, cost_naira: 15500, stock: 6 },
    { title: "Adire tote bag", naira: 25000, cost_naira: 12000, stock: 14 },
    { title: "Silk head wrap", naira: 9500, cost_naira: null, stock: 0 },
    { title: "Indigo throw pillow", naira: 17000, cost_naira: 9000, stock: 3 },
  ]
  for (const p of products) {
    await createSellerProductWorkflow(container).run({
      input: { seller_id: seller.id, title: p.title, price: p.naira, stock: p.stock, ...(p.cost_naira != null ? { cost_price: p.cost_naira } : {}) },
    })
  }
  await addSampleOrders(container, seller.id)

  logger.info(`Demo store ready: ${seller.handle}.aquenora.com (login ${email} / ${password})`)
}

/**
 * Sample orders (placed now) for the demo store, if it has none: repeat and one-off buyers, some
 * who said yes to emails. Real orders will come from Paystack checkout.
 */
async function addSampleOrders(container: ExecArgs["container"], sellerId: string) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: ["id", "products.id", "orders.id"], filters: { id: sellerId } })
  const seller = data[0] as unknown as { products?: ({ id: string } | null)[]; orders?: unknown[] | null }
  const productIds = (seller.products ?? []).filter(Boolean).map((p) => p!.id)
  if ((seller.orders ?? []).filter(Boolean).length > 0 || productIds.length < 2) {
    logger.info("Demo store already has orders (or too few products); no sample orders added.")
    return
  }
  const buyers = [
    { email: "adaeze@example.com", customer_name: "Adaeze Okafor", marketing_opt_in: true },
    { email: "kwame@example.com", customer_name: "Kwame Mensah", marketing_opt_in: true, international: true },
    { email: "ifeoma@example.com", customer_name: "Ifeoma Bello", marketing_opt_in: false },
    { email: "adaeze@example.com", customer_name: "Adaeze Okafor", marketing_opt_in: false },
    { email: "tunde@example.com", customer_name: "Tunde Adeyemi", marketing_opt_in: true },
  ]
  for (const [i, b] of buyers.entries()) {
    await createSellerOrderWorkflow(container).run({
      input: { seller_id: sellerId, ...b, items: [{ product_id: productIds[i % productIds.length], quantity: 1 + (i % 2) }] },
    })
  }
  logger.info(`Added ${buyers.length} sample orders to the demo store.`)
}
