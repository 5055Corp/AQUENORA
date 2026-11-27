// Sends repeating email blasts that are due. A send that can't go (no emails left, sent too
// recently, no subscribers) is skipped this time; the reason is shown to the seller in the app.
import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"
import { saveCampaignScheduleWorkflow } from "../workflows/campaign-schedules"
import { sendCampaignWorkflow } from "../workflows/send-campaign"

export async function sendDueCampaigns(container: MedusaContainer, now = new Date()) {
  const m = container.resolve<MarketingModuleService>(MARKETING_MODULE)
  const due = await m.listMarketingSchedules({ active: true, next_run_at: { $lte: now } }, { take: 200 })
  let sent = 0
  for (const s of due) {
    let error: string | null = null
    try {
      await sendCampaignWorkflow(container).run({ input: { seller_id: s.seller_id, subject: s.subject, message: s.message, audience: s.audience } })
      sent++
    } catch (e) {
      error = (e as Error).message.slice(0, 500)
    }
    await saveCampaignScheduleWorkflow(container).run({ input: { op: "ran", id: s.id, error } })
  }
  return { due: due.length, sent }
}
