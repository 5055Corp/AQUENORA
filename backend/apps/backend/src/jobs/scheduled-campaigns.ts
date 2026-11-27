import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendDueCampaigns } from "../lib/scheduled-campaigns"

/** Every 15 minutes: repeating email blasts that are due. */
export default async function scheduledCampaignsJob(container: MedusaContainer) {
  const r = await sendDueCampaigns(container)
  if (r.due) container.resolve(ContainerRegistrationKeys.LOGGER).info(`Repeating email blasts: ${r.sent} of ${r.due} sent`)
}

export const config = { name: "scheduled-campaigns", schedule: "5,20,35,50 * * * *" }
