import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { startCheckout } from "../../../../../lib/checkout"
import type { CheckoutBody } from "../../../../sellers/validators"

/**
 * POST /store/sellers/:handle/checkout
 * Starts paying for a bag: returns Paystack's payment page (authorization_url) to send the buyer to.
 */
export async function POST(req: MedusaRequest<CheckoutBody>, res: MedusaResponse) {
  res.json(await startCheckout(req.scope, req.params.handle, req.validatedBody))
}
