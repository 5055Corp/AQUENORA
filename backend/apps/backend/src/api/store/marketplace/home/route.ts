import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { home, listedStores } from "../../../../lib/marketplace"

/** GET /store/marketplace/home: categories, featured stores and new products for the shop home page. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.json(home(await listedStores(req.scope)))
}
