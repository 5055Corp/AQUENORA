import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { disputeForOrder, sendDisputeFile } from "../../../../../../../../lib/dispute-access"
import { orderIdFromToken } from "../../../../../../../../lib/order-tracking"

/** GET /store/orders/track/:token/dispute/files/:file: a photo on the buyer's own dispute. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = orderIdFromToken(String(req.params.token ?? ""))
  const d = id ? await disputeForOrder(req.scope, id) : null
  if (!d) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found.")
  await sendDisputeFile(req.scope, d.id, req.params.file, res)
}
