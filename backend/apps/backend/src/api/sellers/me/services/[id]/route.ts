import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteBookingServiceWorkflow, saveBookingServiceWorkflow } from "../../../../../workflows/bookings"
import type { UpdateServiceBody } from "../../../validators"

/** POST /sellers/me/services/:id: change a service (name, time, price, deposit, on/off). */
export async function POST(req: AuthenticatedMedusaRequest<UpdateServiceBody>, res: MedusaResponse) {
  const { result } = await saveBookingServiceWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, id: req.params.id, data: req.validatedBody } })
  res.json({ service: result })
}

/** DELETE /sellers/me/services/:id */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  await deleteBookingServiceWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, id: req.params.id } })
  res.json({ id: req.params.id, deleted: true })
}
