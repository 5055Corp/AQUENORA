import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { listBanks, PAYSTACK_CURRENCY } from "../../../../../lib/paystack"

/** GET /sellers/me/payouts/banks: banks the seller can be paid into (from Paystack, for their currency). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph(
    { entity: "seller", fields: ["id", "country_code"], filters: { id: req.auth_context.actor_id } },
    { throwIfKeyNotFound: true }
  )
  const currency = PAYSTACK_CURRENCY[(data[0] as { country_code: string }).country_code]
  if (!currency) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Paystack doesn't support payouts in your country yet.")
  }
  res.json({ banks: await listBanks(currency) })
}
