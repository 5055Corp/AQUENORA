import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { unhideProductWorkflow } from "../../../../../workflows/moderation"

/** POST /admin/products/:id/unhide: shows a product AQUENORA hid. */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  await unhideProductWorkflow(req.scope).run({ input: { product_id: req.params.id } })
  res.json({ done: true })
}
