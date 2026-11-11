import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { removeCustomHostname } from "../../../../lib/cloudflare"
import { normalizeDomain } from "../../../../lib/domains"
import { resolvePlan } from "../../../../lib/plans"
import { getSellerRow, sellerPlanResponse } from "../../../../lib/seller-plan-route"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { updateSellerWorkflow } from "../../../../workflows/update-seller"
import type { SetDomainBody } from "../../validators"

/** POST /sellers/me/domain: connect a domain the seller owns (Pro or trial). */
export async function POST(req: AuthenticatedMedusaRequest<SetDomainBody>, res: MedusaResponse) {
  const seller = await getSellerRow(req, req.auth_context.actor_id)
  const plan = await resolvePlan(req.scope, seller)
  if (!plan.features.custom_domain) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Your own domain is a Pro feature. Start your free trial or upgrade to connect one.")
  }
  const domain = normalizeDomain(req.validatedBody.domain)
  if (!domain) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That doesn't look like a domain. Type it like adirehouse.com")
  }
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const [taken] = await sellers.listSellers({ custom_domain: domain }, { take: 1 })
  if (taken && taken.id !== seller.id) {
    throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, `${domain} is already connected to another AQENORA store.`)
  }
  if (seller.custom_domain && seller.custom_domain !== domain) {
    await removeCustomHostname(seller.custom_domain).catch(() => undefined)
  }
  await updateSellerWorkflow(req.scope).run({ input: { id: seller.id, data: { custom_domain: domain, domain_verified_at: null } } })
  res.json(await sellerPlanResponse(req, seller.id))
}

/** DELETE /sellers/me/domain: disconnect the domain. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const current = await getSellerRow(req, req.auth_context.actor_id)
  if (current.custom_domain) {
    await removeCustomHostname(current.custom_domain).catch((e) =>
      req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`Cloudflare remove ${current.custom_domain}: ${(e as Error).message}`)
    )
  }
  await updateSellerWorkflow(req.scope).run({
    input: { id: req.auth_context.actor_id, data: { custom_domain: null, domain_verified_at: null } },
  })
  res.json(await sellerPlanResponse(req, req.auth_context.actor_id))
}
