import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { confirmPayment } from "../../../lib/checkout"
import { validWebhookSignature } from "../../../lib/paystack"
import { confirmProPayment } from "../../../lib/pro-billing"
import { confirmBookingPaymentWorkflow } from "../../../workflows/bookings"
import { confirmEmailsWorkflow } from "../../../workflows/email-credits"

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
  if (event.event === "charge.success" && /^aq[prbe]?_/.test(ref)) {
    try {
      // aq_ = a buyer's order; aqb_ = a booking payment (deposit, full, the rest, tip);
      // aqp_ / aqr_ = a seller paying for Pro (first payment / renewal).
      // aqe_ = a seller buying extra emails for blasts.
      if (ref.startsWith("aqb_")) await confirmBookingPaymentWorkflow(req.scope).run({ input: { reference: ref } })
      else if (ref.startsWith("aqe_")) await confirmEmailsWorkflow(req.scope).run({ input: { reference: ref } })
      else await (ref.startsWith("aq_") ? confirmPayment(req.scope, ref) : confirmProPayment(req.scope, ref))
    } catch (e) {
      // A 500 makes Paystack retry later.
      req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`Paystack webhook ${ref}: ${(e as Error).message}`)
      res.status(500).json({ message: "Couldn't record the order yet" })
      return
    }
  }
  res.status(200).json({ received: true })
}
