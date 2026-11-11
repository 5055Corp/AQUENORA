import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BILLING_MODULE } from "../../../../modules/billing"
import type BillingModuleService from "../../../../modules/billing/service"
import { updatePlanPricesWorkflow } from "../../../../workflows/update-billing"
import type { PlanPricesBody } from "../../../sellers/validators"

/** GET /admin/billing/prices: the Pro plan's monthly price in each country (AQUENORA team). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  res.json({ prices: await billing.getPrices() })
}

/** POST /admin/billing/prices: set prices, e.g. { prices: [{ country_code: "NG", monthly_price: 38500 }] }. */
export async function POST(req: AuthenticatedMedusaRequest<PlanPricesBody>, res: MedusaResponse) {
  await updatePlanPricesWorkflow(req.scope).run({ input: { prices: req.validatedBody.prices } })
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  res.json({ prices: await billing.getPrices() })
}
