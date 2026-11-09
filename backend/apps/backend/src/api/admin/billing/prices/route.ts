import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BILLING_MODULE } from "../../../../modules/billing"
import type BillingModuleService from "../../../../modules/billing/service"
import { DEFAULT_PRICES } from "../../../../modules/billing/service"
import type { PlanPricesBody } from "../../../sellers/validators"

/** GET /admin/billing/prices: the Pro plan's monthly price in each country (AQENORA team). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  res.json({ prices: await billing.getPrices() })
}

/** POST /admin/billing/prices: set prices, e.g. { prices: [{ country_code: "NG", monthly_price: 38500 }] }. */
export async function POST(req: AuthenticatedMedusaRequest<PlanPricesBody>, res: MedusaResponse) {
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  const existing = new Map((await billing.listPlanPrices({})).map((p) => [p.country_code, p]))
  for (const p of req.validatedBody.prices) {
    const currency_code = DEFAULT_PRICES[p.country_code].currency_code
    const row = existing.get(p.country_code)
    if (row) {
      await billing.updatePlanPrices({ id: row.id, monthly_price: p.monthly_price, currency_code })
    } else {
      await billing.createPlanPrices({ country_code: p.country_code, currency_code, monthly_price: p.monthly_price })
    }
  }
  res.json({ prices: await billing.getPrices() })
}
