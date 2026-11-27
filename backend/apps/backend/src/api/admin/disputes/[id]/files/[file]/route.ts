import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendDisputeFile } from "../../../../../../lib/dispute-access"

/** GET /admin/disputes/:id/files/:file: a dispute photo (buyer's evidence or seller's refund proof). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  await sendDisputeFile(req.scope, req.params.id, req.params.file, res)
}
