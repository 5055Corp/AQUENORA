import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../../../../modules/seller"
import type SellerModuleService from "../../../../../../modules/seller/service"
import { updateSellerWorkflow } from "../../../../../../workflows/update-seller"
import type { MarkPaidBody } from "../../../../../sellers/validators"

/**
 * POST /admin/billing/sellers/:id/paid  { months }
 * Records a manual payment (e.g. bank transfer): Pro is extended by that many months from today,
 * or from the current paid-until date if that's later.
 */
export async function POST(req: AuthenticatedMedusaRequest<MarkPaidBody>, res: MedusaResponse) {
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const [seller] = await sellers.listSellers({ id: req.params.id }, { take: 1 })
  if (!seller) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Seller not found.")
  }
  const from = seller.pro_paid_until && new Date(seller.pro_paid_until) > new Date() ? new Date(seller.pro_paid_until) : new Date()
  const until = new Date(from)
  until.setMonth(until.getMonth() + req.validatedBody.months)
  await updateSellerWorkflow(req.scope).run({ input: { id: seller.id, data: { pro_paid_until: until } } })
  res.json({ id: seller.id, pro_paid_until: until.toISOString() })
}
