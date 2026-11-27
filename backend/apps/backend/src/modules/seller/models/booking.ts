import { model } from "@medusajs/framework/utils"

/**
 * One appointment. Times are UTC; the seller's time zone is in booking_settings.
 * "pending" holds the slot while the customer pays (it expires after 30 minutes).
 * Money is in the seller's currency: price = the service price, paid = what the provider has
 * received online (not counting AQUENORA's fee or tips), refund_due = what the provider owes back.
 */
const Booking = model.define("booking", {
  id: model.id({ prefix: "bkg" }).primaryKey(),
  seller_id: model.text().index(),
  service_id: model.text().index(),
  service_name: model.text(),
  duration_min: model.number(),
  starts_at: model.dateTime().index(),
  ends_at: model.dateTime(),
  status: model.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]).default("pending"),
  customer_name: model.text(),
  email: model.text(),
  phone: model.text(),
  note: model.text().nullable(),
  currency_code: model.text(),
  price: model.bigNumber(),
  deposit: model.bigNumber(),
  paid: model.bigNumber(),
  tips: model.bigNumber(),
  refund_due: model.bigNumber(),
  refunded_at: model.dateTime().nullable(),
  cancelled_by: model.enum(["customer", "seller"]).nullable(),
  reminded_day_at: model.dateTime().nullable(),
  reminded_hour_at: model.dateTime().nullable(),
  rescheduled: model.number().default(0),
})

export default Booking
