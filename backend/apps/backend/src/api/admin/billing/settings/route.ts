import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BILLING_MODULE } from "../../../../modules/billing"
import type BillingModuleService from "../../../../modules/billing/service"
import { updateBillingSettingsWorkflow } from "../../../../workflows/update-billing"
import type { BillingSettingsBody } from "../../../sellers/validators"

/** GET /admin/billing/settings: commission per plan and trial length (AQUENORA team). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  res.json({ settings: await billing.getSettings() })
}

/** POST /admin/billing/settings: change them. New rates apply to new orders only. */
export async function POST(req: AuthenticatedMedusaRequest<BillingSettingsBody>, res: MedusaResponse) {
  await updateBillingSettingsWorkflow(req.scope).run({ input: req.validatedBody })
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  res.json({ settings: await billing.getSettings() })
}
