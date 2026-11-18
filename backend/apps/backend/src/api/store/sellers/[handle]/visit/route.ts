import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recordVisit, type VisitSource } from "../../../../../lib/visits"
import type { StoreVisitBody } from "../../../../sellers/validators"

/**
 * POST /store/sellers/:handle/visit { source }
 * The store page counts one visit per browser per day. Only a count is kept, never who visited.
 */
export async function POST(req: MedusaRequest<StoreVisitBody>, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: ["id"], filters: { handle: req.params.handle } })
  const seller = data[0] as { id: string } | undefined
  if (seller) await recordVisit(req.scope, seller.id, req.validatedBody.source as VisitSource)
  // Same answer either way: nothing to learn from it.
  res.status(204).send()
}
