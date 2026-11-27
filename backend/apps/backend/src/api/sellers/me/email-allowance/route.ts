import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { emailAllowance } from "../../../../lib/email-allowance"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

/** GET /sellers/me/email-allowance: free emails left this month, bought emails, and the price of an extra one. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const seller = await req.scope.resolve<SellerModuleService>(SELLER_MODULE).retrieveSeller(req.auth_context.actor_id)
  res.json({ allowance: await emailAllowance(req.scope, seller as never) })
}
