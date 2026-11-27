import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { serviceView, type ServiceRow } from "../../../../lib/bookings"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"
import { saveBookingServiceWorkflow } from "../../../../workflows/bookings"
import type { CreateServiceBody } from "../../validators"

/** GET /sellers/me/services: what customers can book. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const rows = (await req.scope.resolve<SellerModuleService>(SELLER_MODULE).listBookingServices({ seller_id: req.auth_context.actor_id }, { order: { sort: "ASC", created_at: "ASC" }, take: 100 })) as unknown as ServiceRow[]
  res.json({ services: rows.map(serviceView) })
}

/** POST /sellers/me/services: add a service. */
export async function POST(req: AuthenticatedMedusaRequest<CreateServiceBody>, res: MedusaResponse) {
  const { result } = await saveBookingServiceWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, data: req.validatedBody } })
  res.status(201).json({ service: result })
}
