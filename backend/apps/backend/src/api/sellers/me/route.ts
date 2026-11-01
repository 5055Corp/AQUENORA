import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateSellerWorkflow } from "../../../workflows/update-seller"
import { SELLER_FIELDS } from "../fields"
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
  await updateSellerWorkflow(req.scope).run({
    input: { id: req.auth_context.actor_id, data: req.validatedBody },
  })

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: SELLER_FIELDS,
    filters: { id: req.auth_context.actor_id },
  })
  res.json({ seller: data[0] })
}
