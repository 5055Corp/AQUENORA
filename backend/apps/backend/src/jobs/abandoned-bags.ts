import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { remindAbandonedBagsWorkflow } from "../workflows/abandoned-bags"

/** Every 15 minutes: one "you left something in your bag" email to shoppers who didn't finish paying. */
export default async function abandonedBagsJob(container: MedusaContainer) {
  const { result } = await remindAbandonedBagsWorkflow(container).run({ input: {} })
  if (result) {
    container.resolve(ContainerRegistrationKeys.LOGGER).info(`Abandoned bag reminders sent: ${result}`)
  }
}

export const config = {
  name: "abandoned-bags",
  schedule: "*/15 * * * *",
}
