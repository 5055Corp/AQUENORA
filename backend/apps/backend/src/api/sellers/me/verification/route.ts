import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { submitSellerVerificationWorkflow } from "../../../../workflows/seller-verification"
import type { SubmitVerificationBody } from "../../validators"

async function status(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    { entity: "seller", fields: ["id", "verification_status", "verification", "verified_at"], filters: { id: req.auth_context.actor_id } },
    { throwIfKeyNotFound: true }
  )
  const s = data[0] as unknown as { verification_status: string; verification: Record<string, unknown> | null; verified_at: string | null }
  return { status: s.verification_status, details: s.verification, verified_at: s.verified_at }
}

/** GET /sellers/me/verification: where the seller's verification stands (documents aren't sent back). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.json({ verification: await status(req) })
}

/** POST /sellers/me/verification: send details and documents for AQUENORA to check. */
export async function POST(req: AuthenticatedMedusaRequest<SubmitVerificationBody>, res: MedusaResponse) {
  await submitSellerVerificationWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, body: req.validatedBody } })
  res.json({ verification: await status(req) })
}
