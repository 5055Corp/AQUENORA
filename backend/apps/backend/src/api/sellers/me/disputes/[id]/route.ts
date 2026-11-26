import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { disputeActionWorkflow } from "../../../../../workflows/disputes"
import type { SellerDisputeActionBody } from "../../../validators"

/** POST /sellers/me/disputes/:id { action: message | refunded, text, amount, files }. */
export async function POST(req: AuthenticatedMedusaRequest<SellerDisputeActionBody>, res: MedusaResponse) {
  const { result } = await disputeActionWorkflow(req.scope).run({
    input: { dispute_id: req.params.id, actor: "seller", seller_id: req.auth_context.actor_id, ...req.validatedBody },
  })
  res.json({ dispute: result })
}
