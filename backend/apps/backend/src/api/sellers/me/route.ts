import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { removeCustomHostname } from "../../../lib/cloudflare"
import { deleteSellerAccountWorkflow } from "../../../workflows/delete-seller-account"
import { updateSellerWorkflow } from "../../../workflows/update-seller"
import { SELLER_FIELDS } from "../fields"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import type { UpdateSellerBody } from "../validators"

/** GET /sellers/me: the signed-in seller's store details. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    {
      entity: "seller",
      fields: SELLER_FIELDS,
      filters: { id: req.auth_context.actor_id },
    },
    { throwIfKeyNotFound: true }
  )
  res.json({ seller: data[0] })
}

/** POST /sellers/me: update shop details, onboarding progress or store design. */
export async function POST(req: AuthenticatedMedusaRequest<UpdateSellerBody>, res: MedusaResponse) {
  const changes: Record<string, unknown> = { ...req.validatedBody }
  if (req.validatedBody.booking_settings) {
    // Keep the private calendar link (it isn't part of what the app sends).
    const current = (await req.scope.resolve<SellerModuleService>(SELLER_MODULE).retrieveSeller(req.auth_context.actor_id)) as unknown as { booking_settings?: { calendar_key?: string } | null }
    const key = current.booking_settings?.calendar_key
    changes.booking_settings = { ...req.validatedBody.booking_settings, ...(key ? { calendar_key: key } : {}) }
  }
  await updateSellerWorkflow(req.scope).run({
    input: { id: req.auth_context.actor_id, data: changes },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: SELLER_FIELDS,
    filters: { id: req.auth_context.actor_id },
  })
  res.json({ seller: data[0] })
}

/**
 * DELETE /sellers/me: delete the seller's account and take the store offline for good
 * (app: Settings → Delete account). Order and payment records are kept, as the law requires.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    { entity: "seller", fields: ["id", "custom_domain"], filters: { id: req.auth_context.actor_id } },
    { throwIfKeyNotFound: true }
  )
  const domain = data[0]?.custom_domain
  if (domain) {
    await removeCustomHostname(domain).catch((e) =>
      req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`Cloudflare remove ${domain}: ${(e as Error).message}`)
    )
  }
  await deleteSellerAccountWorkflow(req.scope).run({
    input: { seller_id: req.auth_context.actor_id, auth_identity_id: req.auth_context.auth_identity_id },
  })
  res.json({ deleted: true })
}
