import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reportProductWorkflow } from "../../../../../workflows/moderation"
import type { ReportProductBody } from "../../../../sellers/validators"

/** POST /store/products/:id/report { reason, note }: a shopper reports a product to AQUENORA. */
export async function POST(req: MedusaRequest<ReportProductBody>, res: MedusaResponse) {
  await reportProductWorkflow(req.scope).run({ input: { product_id: req.params.id, ...req.validatedBody } })
  res.status(201).json({ reported: true })
}
