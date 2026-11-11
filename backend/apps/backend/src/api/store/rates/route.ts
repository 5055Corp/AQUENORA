import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getRates } from "../../../lib/rates"

/**
 * GET /store/rates
 * Exchange rates (units per 1 USD) so store pages can show prices in a buyer's own currency.
 * Payment is always in the seller's currency; these are for display only.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader("cache-control", "public, max-age=3600")
  res.json(await getRates())
}
