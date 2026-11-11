import { model } from "@medusajs/framework/utils"

/** One row: AQUENORA's commission per plan and the trial length, editable in the admin dashboard. */
const BillingSettings = model.define("billing_settings", {
  id: model.id({ prefix: "bset" }).primaryKey(),
  free_commission_percent: model.float().default(3),
  pro_commission_percent: model.float().default(1),
  trial_days: model.number().default(14),
})

export default BillingSettings
