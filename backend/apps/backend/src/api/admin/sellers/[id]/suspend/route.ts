import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { suspendSellerWorkflow } from "../../../../../workflows/moderation"
import type { SuspendSellerBody } from "../../../../sellers/validators"

/** POST /admin/sellers/:id/suspend { suspend, reason }: pauses a store (hidden, no payments) or restores it. */
export async function POST(req: MedusaRequest<SuspendSellerBody>, res: MedusaResponse) {
  await suspendSellerWorkflow(req.scope).run({ input: { seller_id: req.params.id, ...req.validatedBody } })
  res.json({ done: true })
}
