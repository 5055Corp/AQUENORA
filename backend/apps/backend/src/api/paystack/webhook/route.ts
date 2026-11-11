import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { confirmPayment } from "../../../lib/checkout"
import { validWebhookSignature } from "../../../lib/paystack"
import { confirmProPayment } from "../../../lib/pro-billing"

/**
 * POST /paystack/webhook
 * Paystack calls this after each payment (set it as the Webhook URL in the Paystack dashboard).
 * It creates the order even if the buyer closed the page before coming back to the store.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const raw = (req as MedusaRequest & { rawBody?: Buffer }).rawBody
  if (!raw || !validWebhookSignature(raw, req.headers["x-paystack-signature"] as string | undefined)) {
    res.status(401).json({ message: "Invalid signature" })
    return
  }
  const event = req.body as { event?: string; data?: { reference?: string } }
  const ref = event.data?.reference ?? ""
  if (event.event === "charge.success" && /^aq[pr]?_/.test(ref)) {
    try {
      // aq_ = a buyer's order; aqp_ / aqr_ = a seller paying for Pro (first payment / renewal).
      await (ref.startsWith("aq_") ? confirmPayment(req.scope, ref) : confirmProPayment(req.scope, ref))
    } catch (e) {
      // A 500 makes Paystack retry later.
      req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`Paystack webhook ${ref}: ${(e as Error).message}`)
      res.status(500).json({ message: "Couldn't record the order yet" })
      return
    }
  }
  res.status(200).json({ received: true })
}
