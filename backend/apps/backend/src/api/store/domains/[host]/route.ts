import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { normalizeDomain } from "../../../../lib/domains"
import { resolvePlan } from "../../../../lib/plans"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

/**
 * GET /store/domains/:host
 * Which store a seller's own domain opens (used by the web server and store page). Only connected
 * domains of shops on Pro or a trial.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const domain = normalizeDomain(req.params.host)
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const [seller] = domain ? await sellers.listSellers({ custom_domain: domain }, { take: 1 }) : []
  if (!seller || !seller.domain_verified_at || !(await resolvePlan(req.scope, seller)).features.custom_domain) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No store is connected to this domain.")
  }
  res.json({ handle: seller.handle })
}
