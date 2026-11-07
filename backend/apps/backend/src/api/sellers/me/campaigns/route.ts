import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { sendCampaignWorkflow } from "../../../../workflows/send-campaign"
import type { SendCampaignBody } from "../../validators"

/** GET /sellers/me/campaigns: the seller's sent campaigns, newest first. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const marketing: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
  const campaigns = await marketing.listMarketingCampaigns(
    { seller_id: req.auth_context.actor_id },
    { order: { created_at: "DESC" }, take: 50 }
  )
  res.json({ campaigns })
}

/** POST /sellers/me/campaigns: email a group of past buyers now. */
export async function POST(req: AuthenticatedMedusaRequest<SendCampaignBody>, res: MedusaResponse) {
  const { result } = await sendCampaignWorkflow(req.scope).run({
    input: { seller_id: req.auth_context.actor_id, ...req.validatedBody },
  })
  res.status(201).json({ campaign: result })
}
