import { model } from "@medusajs/framework/utils"

/**
 * One Pro payment by card through Paystack: the first one (the seller pays on Paystack's page)
 * or a monthly renewal (AQUENORA charges the saved card). The reference is unique, so a payment
 * extends Pro only once even if Paystack confirms it twice.
 */
const ProPayment = model.define("pro_payment", {
  id: model.id({ prefix: "propay" }).primaryKey(),
  reference: model.text().unique(),
  seller_id: model.text().index(),
  kind: model.enum(["first", "renewal"]),
  status: model.enum(["pending", "paid", "failed"]).default("pending"),
  // What was charged (Paystack currency, whole units), and the seller's own price it stands for.
  amount: model.bigNumber(),
  currency_code: model.text(),
  price_amount: model.bigNumber(),
  price_currency_code: model.text(),
  // Pro is paid until this date after this payment.
  period_end: model.dateTime().nullable(),
  message: model.text().nullable(),
})

export default ProPayment
