import { model } from "@medusajs/framework/utils"

/** One row: AQUENORA's commission per plan and the trial length, editable in the admin dashboard. */
const BillingSettings = model.define("billing_settings", {
  id: model.id({ prefix: "bset" }).primaryKey(),
  free_commission_percent: model.float().default(3),
  pro_commission_percent: model.float().default(1),
  trial_days: model.number().default(14),
  /** Bookings: AQUENORA's fee, added ON TOP of what the customer pays online (the provider gets the full price). */
  booking_fee_percent: model.float().default(3),
  /** Email blasts: free emails per seller per month, then this price (in naira) per extra email. */
  free_emails_per_month: model.number().default(100),
  extra_email_price_ngn: model.float().default(20),
})

export default BillingSettings
