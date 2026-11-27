import { model } from "@medusajs/framework/utils"

/**
 * One online payment for a booking (Paystack). kind: "booking" (deposit or full, when booking),
 * "balance" (the rest, paid before the appointment) or "tip".
 * amount goes to the provider; fee is AQUENORA's (added on top; 0 for tips); total = amount + fee.
 */
const BookingPayment = model.define("booking_payment", {
  id: model.id({ prefix: "bpay" }).primaryKey(),
  reference: model.text().unique(),
  booking_id: model.text().index(),
  seller_id: model.text().index(),
  kind: model.enum(["booking", "balance", "tip"]),
  status: model.enum(["pending", "paid", "failed"]).default("pending"),
  currency_code: model.text(),
  amount: model.bigNumber(),
  fee: model.bigNumber(),
  total: model.bigNumber(),
})

export default BookingPayment
