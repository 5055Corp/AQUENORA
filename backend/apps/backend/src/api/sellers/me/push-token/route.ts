import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { savePushTokenWorkflow } from "../../../../workflows/push-token"
import type { PushTokenBody } from "../../validators"

/** POST /sellers/me/push-token { token }: send this iPhone notifications (new orders, problems...). */
export async function POST(req: AuthenticatedMedusaRequest<PushTokenBody>, res: MedusaResponse) {
  await savePushTokenWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, token: req.validatedBody.token } })
  res.json({ saved: true })
}

/** DELETE /sellers/me/push-token { token }: stop (on log-out). */
export async function DELETE(req: AuthenticatedMedusaRequest<PushTokenBody>, res: MedusaResponse) {
  await savePushTokenWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, token: req.validatedBody.token, remove: true } })
  res.json({ saved: false })
}
