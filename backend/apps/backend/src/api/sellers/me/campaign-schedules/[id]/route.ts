import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveCampaignScheduleWorkflow } from "../../../../../workflows/campaign-schedules"
import type { UpdateScheduleBody } from "../../../validators"

/** POST /sellers/me/campaign-schedules/:id { active }: pause or restart. */
export async function POST(req: AuthenticatedMedusaRequest<UpdateScheduleBody>, res: MedusaResponse) {
  const { result } = await saveCampaignScheduleWorkflow(req.scope).run({ input: { op: "update", seller_id: req.auth_context.actor_id, id: req.params.id, active: req.validatedBody.active } })
  res.json({ schedule: result })
}

/** DELETE /sellers/me/campaign-schedules/:id */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await saveCampaignScheduleWorkflow(req.scope).run({ input: { op: "delete", seller_id: req.auth_context.actor_id, id: req.params.id } })
  res.json({ id: req.params.id, deleted: true })
}
