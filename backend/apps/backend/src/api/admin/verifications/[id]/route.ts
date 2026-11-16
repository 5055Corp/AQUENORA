import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { reviewSellerVerificationWorkflow } from "../../../../workflows/seller-verification"
import type { ReviewVerificationBody } from "../../../sellers/validators"

/** GET /admin/verifications/:id: the seller's documents (kinds and types; open each with /documents/:doc). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const docs = await sellers.listSellerDocuments({ seller_id: req.params.id }, { select: ["id", "kind", "mime_type", "created_at"] })
  res.json({ documents: docs })
}

/** POST /admin/verifications/:id { decision: "approve" | "reject", reason }: AQUENORA's decision; the seller is emailed. */
export async function POST(req: MedusaRequest<ReviewVerificationBody>, res: MedusaResponse) {
  const { result } = await reviewSellerVerificationWorkflow(req.scope).run({
    input: { seller_id: req.params.id, decision: req.validatedBody.decision, reason: req.validatedBody.reason },
  })
  res.json({ approved: result.approved })
}
