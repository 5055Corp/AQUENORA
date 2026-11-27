import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { saveCampaignScheduleWorkflow } from "../../../../workflows/campaign-schedules"
import type { CreateScheduleBody } from "../../validators"

/** GET /sellers/me/campaign-schedules: repeating email blasts. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const schedules = await req.scope.resolve<MarketingModuleService>(MARKETING_MODULE).listMarketingSchedules({ seller_id: req.auth_context.actor_id }, { order: { created_at: "DESC" } })
  res.json({ schedules })
}

/** POST /sellers/me/campaign-schedules: send this blast every week or month. */
export async function POST(req: AuthenticatedMedusaRequest<CreateScheduleBody>, res: MedusaResponse) {
  const { result } = await saveCampaignScheduleWorkflow(req.scope).run({ input: { op: "create", seller_id: req.auth_context.actor_id, data: req.validatedBody } })
  res.status(201).json({ schedule: result })
}
