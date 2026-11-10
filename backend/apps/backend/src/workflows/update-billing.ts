import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"
import { DEFAULT_PRICES, type Settings } from "../modules/billing/service"

type PriceInput = { country_code: string; monthly_price: number }
type PriceRow = { id: string; country_code: string; currency_code: string; monthly_price: number }

/** Saves Pro prices per country; on failure, puts back the old ones and removes new rows. */
const upsertPlanPricesStep = createStep(
  "upsert-plan-prices",
  async (prices: PriceInput[], { container }) => {
    const billing: BillingModuleService = container.resolve(BILLING_MODULE)
    const existing = new Map(((await billing.listPlanPrices({})) as PriceRow[]).map((p) => [p.country_code, p]))
    const undo = { restore: [] as PriceRow[], created: [] as string[] }
    for (const p of prices) {
      const currency_code = DEFAULT_PRICES[p.country_code].currency_code
      const row = existing.get(p.country_code)
      if (row) {
        undo.restore.push(row)
        await billing.updatePlanPrices({ id: row.id, monthly_price: p.monthly_price, currency_code })
      } else {
        const created = await billing.createPlanPrices({ country_code: p.country_code, currency_code, monthly_price: p.monthly_price })
        undo.created.push(created.id)
      }
    }
    return new StepResponse(true, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const billing: BillingModuleService = container.resolve(BILLING_MODULE)
    for (const row of undo.restore) {
      await billing.updatePlanPrices({ id: row.id, monthly_price: row.monthly_price, currency_code: row.currency_code })
    }
    if (undo.created.length) {
      await billing.deletePlanPrices(undo.created)
    }
  }
)

export const updatePlanPricesWorkflow = createWorkflow("update-plan-prices", function (input: { prices: PriceInput[] }) {
  const done = upsertPlanPricesStep(input.prices)
  return new WorkflowResponse(done)
})

type SettingsUndo = {
  before?: { id: string; free_commission_percent: number; pro_commission_percent: number; trial_days: number }
  created?: string
}

/** Saves commission and trial settings (a single row). */
const saveBillingSettingsStep = createStep(
  "save-billing-settings",
  async (input: Partial<Settings>, { container }) => {
    const billing: BillingModuleService = container.resolve(BILLING_MODULE)
    const [row] = await billing.listBillingSettings({}, { take: 1 })
    if (row) {
      const before = { id: row.id, free_commission_percent: row.free_commission_percent, pro_commission_percent: row.pro_commission_percent, trial_days: row.trial_days }
      await billing.updateBillingSettings({ id: row.id, ...input })
      const undo: SettingsUndo = { before }
      return new StepResponse(true, undo)
    }
    const created = await billing.createBillingSettings({ ...(await billing.getSettings()), ...input })
    const undo: SettingsUndo = { created: created.id }
    return new StepResponse(true, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const billing: BillingModuleService = container.resolve(BILLING_MODULE)
    if (undo.before) {
      await billing.updateBillingSettings(undo.before)
    } else if (undo.created) {
      await billing.deleteBillingSettings(undo.created)
    }
  }
)

export const updateBillingSettingsWorkflow = createWorkflow("update-billing-settings", function (input: Partial<Settings>) {
  const done = saveBillingSettingsStep(input)
  return new WorkflowResponse(done)
})
