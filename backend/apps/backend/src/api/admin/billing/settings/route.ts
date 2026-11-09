import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BILLING_MODULE } from "../../../../modules/billing"
import type BillingModuleService from "../../../../modules/billing/service"
import type { BillingSettingsBody } from "../../../sellers/validators"

/** GET /admin/billing/settings: commission per plan and trial length (AQENORA team). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  res.json({ settings: await billing.getSettings() })
}

/** POST /admin/billing/settings: change them. New rates apply to new orders only. */
export async function POST(req: AuthenticatedMedusaRequest<BillingSettingsBody>, res: MedusaResponse) {
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  const [row] = await billing.listBillingSettings({}, { take: 1 })
  if (row) {
    await billing.updateBillingSettings({ id: row.id, ...req.validatedBody })
  } else {
    await billing.createBillingSettings({ ...(await billing.getSettings()), ...req.validatedBody })
  }
  res.json({ settings: await billing.getSettings() })
}
