import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { listedStores, search } from "../../../lib/marketplace"

/**
 * GET /store/marketplace?q=adire&category=Fashion%20%26%20clothing
 * AQUENORA shopping search: matching products grouped by store (see lib/marketplace.ts).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : ""
  const category = typeof req.query.category === "string" ? req.query.category.trim() : ""
  if (q.length > 80 || category.length > 60) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That search is too long.")
  }
  if (!q && !category) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Type something to search for.")
  }
  res.json(search(await listedStores(req.scope), q, category || undefined))
}
