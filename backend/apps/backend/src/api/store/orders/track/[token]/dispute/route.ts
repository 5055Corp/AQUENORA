import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { disputeForOrder } from "../../../../../../lib/dispute-access"
import { orderIdFromToken } from "../../../../../../lib/order-tracking"
import { disputeActionWorkflow, openDisputeWorkflow } from "../../../../../../workflows/disputes"
import type { BuyerDisputeActionBody, OpenDisputeBody } from "../../../../../sellers/validators"

const orderId = (token: unknown) => {
  const id = orderIdFromToken(String(token ?? ""))
  if (!id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that order.")
  return id
}

/** POST /store/orders/track/:token/dispute { reason, message, files }: the buyer reports a problem. */
export async function POST(req: MedusaRequest<OpenDisputeBody>, res: MedusaResponse) {
  const { result } = await openDisputeWorkflow(req.scope).run({ input: { order_id: orderId(req.params.token), ...req.validatedBody } })
  res.status(201).json({ dispute: result })
}

/** PATCH /store/orders/track/:token/dispute { action: message | confirm | escalate, text, files }. */
export async function PATCH(req: MedusaRequest<BuyerDisputeActionBody>, res: MedusaResponse) {
  const d = await disputeForOrder(req.scope, orderId(req.params.token))
  if (!d) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No problem has been reported on this order.")
  const { result } = await disputeActionWorkflow(req.scope).run({ input: { dispute_id: d.id, actor: "buyer", ...req.validatedBody } })
  res.json({ dispute: result })
}
