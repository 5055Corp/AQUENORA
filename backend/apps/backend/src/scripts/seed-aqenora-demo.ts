import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { createSellerWorkflow } from "../workflows/create-seller"
import { createSellerProductWorkflow } from "../workflows/create-seller-product"

/**
 * Creates the demo seller from the prototype ("Adire House", Nigeria) with a login and four products.
 * Run: npx medusa exec ./src/scripts/seed-aqenora-demo.ts
 * Safe to run twice: it stops if the store already exists.
 */
export default async function seedAqenoraDemo({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const auth = container.resolve(Modules.AUTH)

  const email = "demo@aqenora.com"
  const password = "aqenora-demo"

  // The store page (app/store.html) needs this key in VITE_MEDUSA_PUBLISHABLE_KEY.
  const apiKeys = container.resolve(Modules.API_KEY)
  const publishable = (await apiKeys.listApiKeys({ type: "publishable" })).find((k) => !k.revoked_at)
  if (publishable) {
    logger.info(`Publishable API key for the store page: VITE_MEDUSA_PUBLISHABLE_KEY=${publishable.token}`)
  }

  const [existing] = await sellers.listSellers({ handle: "adirehouse" }, { take: 1 })
  if (existing) {
    logger.info("Demo store adirehouse already exists, skipping.")
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
    { title: "Indigo adire kimono", naira: 28000, stock: 6 },
    { title: "Adire tote bag", naira: 25000, stock: 14 },
    { title: "Silk head wrap", naira: 9500, stock: 0 },
    { title: "Indigo throw pillow", naira: 17000, stock: 3 },
  ]
  for (const p of products) {
    await createSellerProductWorkflow(container).run({
      input: { seller_id: seller.id, title: p.title, price: p.naira, stock: p.stock },
    })
  }

  logger.info(`Demo store ready: ${seller.handle}.aqenora.com (login ${email} / ${password})`)
}
