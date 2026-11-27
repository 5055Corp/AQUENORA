import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { disputeActionWorkflow } from "../../../../workflows/disputes"
import type { AdminDisputeActionBody } from "../../../sellers/validators"

/** POST /admin/disputes/:id { action: decide | message | confirm, outcome, text, amount }: AQUENORA steps in. */
export async function POST(req: MedusaRequest<AdminDisputeActionBody>, res: MedusaResponse) {
  const { result } = await disputeActionWorkflow(req.scope).run({ input: { dispute_id: req.params.id, actor: "aquenora", ...req.validatedBody } })
  res.json({ dispute: result })
}
