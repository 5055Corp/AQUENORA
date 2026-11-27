import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { slotsFor } from "../../../../../../lib/booking-flow"

/** GET /store/sellers/:handle/booking/slots?service_id=&date=YYYY-MM-DD[&addons=id,id]: free start times (UTC). */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { service_id, date, addons } = req.query as { service_id?: string; date?: string; addons?: string }
  if (!service_id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Choose a service and a day.")
  res.json({ slots: await slotsFor(req.scope, req.params.handle, service_id, date, addons ? String(addons).split(",").slice(0, 15) : []) })
}
