import { model } from "@medusajs/framework/utils"

/** A seller buying extra emails for blasts (beyond the free ones each month). Paid by card to AQUENORA. */
const EmailPurchase = model.define("email_purchase", {
  id: model.id({ prefix: "emlp" }).primaryKey(),
  reference: model.text().unique(),
  seller_id: model.text().index(),
  count: model.number(),
  status: model.enum(["pending", "paid", "failed"]).default("pending"),
  amount: model.bigNumber(),
  currency_code: model.text(),
})

export default EmailPurchase
