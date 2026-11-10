import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { confirmPayment } from "../../../lib/checkout"
import { validWebhookSignature } from "../../../lib/paystack"

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
  if (event.event === "charge.success" && event.data?.reference?.startsWith("aq_")) {
    try {
      await confirmPayment(req.scope, event.data.reference)
    } catch (e) {
      // A 500 makes Paystack retry later.
      req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`Paystack webhook ${event.data.reference}: ${(e as Error).message}`)
      res.status(500).json({ message: "Couldn't record the order yet" })
      return
    }
  }
  res.status(200).json({ received: true })
}
