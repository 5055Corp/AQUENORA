import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createStockAlertWorkflow } from "../../../../../workflows/stock-alerts"
import type { StockAlertBody } from "../../../../sellers/validators"

/** POST /store/products/:id/notify { email, choice }: email me when this (choice) is back in stock. */
export async function POST(req: MedusaRequest<StockAlertBody>, res: MedusaResponse) {
  await createStockAlertWorkflow(req.scope).run({ input: { product_id: req.params.id, ...req.validatedBody } })
  res.status(201).json({ waiting: true })
}
