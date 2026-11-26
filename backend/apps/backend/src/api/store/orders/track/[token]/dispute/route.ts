import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { disputeForOrder } from "../../../../../../lib/dispute-access"
import { orderIdFromToken } from "../../../../../../lib/order-tracking"
import { pushToSeller } from "../../../../../../lib/push"
import { disputeActionWorkflow, openDisputeWorkflow } from "../../../../../../workflows/disputes"
import type { BuyerDisputeActionBody, OpenDisputeBody } from "../../../../../sellers/validators"

const orderId = (token: unknown) => {
  const id = orderIdFromToken(String(token ?? ""))
  if (!id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that order.")
  return id
}

/** POST /store/orders/track/:token/dispute { reason, message, files }: the buyer reports a problem. */
export async function POST(req: MedusaRequest<OpenDisputeBody>, res: MedusaResponse) {
  const id = orderId(req.params.token)
  const { result } = await openDisputeWorkflow(req.scope).run({ input: { order_id: id, ...req.validatedBody } })
  const d = await disputeForOrder(req.scope, id)
  if (d) await pushToSeller(req.scope, d.seller_id, { title: `Problem with order #${result.order_display_id}`, body: `${result.reason_label}. Reply within 2 working days.`, tab: "orders" })
  res.status(201).json({ dispute: result })
}

/** PATCH /store/orders/track/:token/dispute { action: message | confirm | escalate, text, files }. */
export async function PATCH(req: MedusaRequest<BuyerDisputeActionBody>, res: MedusaResponse) {
  const d = await disputeForOrder(req.scope, orderId(req.params.token))
  if (!d) throw new MedusaError(MedusaError.Types.NOT_FOUND, "No problem has been reported on this order.")
  const { result } = await disputeActionWorkflow(req.scope).run({ input: { dispute_id: d.id, actor: "buyer", ...req.validatedBody } })
  if (req.validatedBody.action === "message") await pushToSeller(req.scope, d.seller_id, { title: `Buyer replied on order #${result.order_display_id}`, body: (req.validatedBody.text ?? "").slice(0, 150), tab: "orders" })
  res.json({ dispute: result })
}
