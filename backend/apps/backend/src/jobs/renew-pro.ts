import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { paystackEnabled } from "../lib/paystack"
import { renewDuePro } from "../lib/pro-billing"

/** Every hour: charge the saved cards of sellers whose Pro month is about to end. */
export default async function renewProJob(container: MedusaContainer) {
  if (!paystackEnabled()) {
    return
  }
  const results = await renewDuePro(container)
  if (results.length) {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
    const paid = results.filter((r) => r.status === "paid").length
    logger.info(`Pro renewals: ${paid} paid, ${results.length - paid} failed`)
  }
}

export const config = {
  name: "renew-pro",
  schedule: "17 * * * *",
}
