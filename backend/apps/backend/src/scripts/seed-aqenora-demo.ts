import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
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

  const [existing] = await sellers.listSellers({ handle: "adirehouse" }, { take: 1 })
  if (existing) {
    logger.info("Demo store adirehouse already exists, skipping.")
    return
  }

  const { success, authIdentity, error } = await auth.register("emailpass", {
    body: { email, password },
  } as Parameters<typeof auth.register>[1])
  if (!success || !authIdentity) {
    throw new Error(`Could not create the demo login: ${error}`)
  }

  const { result: seller } = await createSellerWorkflow(container).run({
    input: {
      auth_identity_id: authIdentity.id,
      seller: { email, name: "Adire House", category: "Fashion & clothing", country_code: "NG" },
    },
  })

  const products = [
    { title: "Indigo adire kimono", price: 28000, stock: 6 },
    { title: "Adire tote bag", price: 25000, stock: 14 },
    { title: "Silk head wrap", price: 9500, stock: 0 },
    { title: "Indigo throw pillow", price: 17000, stock: 3 },
  ]
  for (const p of products) {
    await createSellerProductWorkflow(container).run({ input: { seller_id: seller.id, ...p } })
  }

  logger.info(`Demo store ready: ${seller.handle}.aqenora.com (login ${email} / ${password})`)
}
