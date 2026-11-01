import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { createSellerWorkflow } from "../../workflows/create-seller"
import type { CreateSellerBody } from "./validators"

/**
 * POST /sellers
 * Creates the store for a newly registered seller login.
 * Call /auth/seller/emailpass/register first and send its token as the Bearer token.
 */
export async function POST(req: AuthenticatedMedusaRequest<CreateSellerBody>, res: MedusaResponse) {
  if (req.auth_context.actor_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This login already has a store.")
  }

  const authModule = req.scope.resolve(Modules.AUTH)
  const identity = await authModule.retrieveAuthIdentity(req.auth_context.auth_identity_id, {
    relations: ["provider_identities"],
  })
  const email = identity.provider_identities?.find((p) => p.provider === "emailpass")?.entity_id

  if (!email) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Sign up with an email and password first.")
  }

  const { result: seller } = await createSellerWorkflow(req.scope).run({
    input: {
      auth_identity_id: req.auth_context.auth_identity_id,
      seller: { ...req.validatedBody, email },
    },
  })

  res.status(201).json({ seller })
}
