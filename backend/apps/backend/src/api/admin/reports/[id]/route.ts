import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reviewReportWorkflow } from "../../../../workflows/moderation"
import type { ReviewReportBody } from "../../../sellers/validators"

/** POST /admin/reports/:id { action: hide | dismiss, reason }: settles every open report on that product. */
export async function POST(req: MedusaRequest<ReviewReportBody>, res: MedusaResponse) {
  await reviewReportWorkflow(req.scope).run({ input: { report_id: req.params.id, ...req.validatedBody } })
  res.json({ done: true })
}
