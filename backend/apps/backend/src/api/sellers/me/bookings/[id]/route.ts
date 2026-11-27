import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sellerBookingActionWorkflow } from "../../../../../workflows/bookings"
import type { SellerBookingActionBody } from "../../../validators"

/** POST /sellers/me/bookings/:id { action: complete | no_show | cancel | refunded, reason? } */
export async function POST(req: AuthenticatedMedusaRequest<SellerBookingActionBody>, res: MedusaResponse) {
  const { result } = await sellerBookingActionWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, booking_id: req.params.id, data: req.validatedBody } })
  res.json({ booking: result })
}
