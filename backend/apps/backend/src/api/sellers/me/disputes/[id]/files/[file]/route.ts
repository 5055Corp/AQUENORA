import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { sendDisputeFile } from "../../../../../../../lib/dispute-access"
import { SELLER_MODULE } from "../../../../../../../modules/seller"
import type SellerModuleService from "../../../../../../../modules/seller/service"

/** GET /sellers/me/disputes/:id/files/:file: a photo on one of this seller's disputes. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const [d] = await req.scope.resolve<SellerModuleService>(SELLER_MODULE).listDisputes({ id: req.params.id, seller_id: req.auth_context.actor_id })
  if (!d) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found.")
  await sendDisputeFile(req.scope, d.id, req.params.file, res)
}
