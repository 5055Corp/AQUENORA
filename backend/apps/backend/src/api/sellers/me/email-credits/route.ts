import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { buyEmailsWorkflow } from "../../../../workflows/email-credits"
import type { BuyEmailsBody } from "../../validators"

/** POST /sellers/me/email-credits { count, return_url }: buy extra emails (Paystack card page). Website only. */
export async function POST(req: AuthenticatedMedusaRequest<BuyEmailsBody>, res: MedusaResponse) {
  const { result } = await buyEmailsWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, ...req.validatedBody } })
  res.json(result)
}
