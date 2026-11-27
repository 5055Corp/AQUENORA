import { model } from "@medusajs/framework/utils"

/**
 * Something a customer can book (a service provider's "product"): a haircut, makeup, a photo shoot.
 * Prices are in the seller's currency, whole units.
 */
const BookingService = model.define("booking_service", {
  id: model.id({ prefix: "bsvc" }).primaryKey(),
  seller_id: model.text().index(),
  name: model.text(),
  description: model.text().nullable(),
  duration_min: model.number(),
  price: model.bigNumber(),
  // How customers pay: "deposit" (deposit online, the rest at the appointment or online),
  // "full" (everything online when booking), "none" (pay at the appointment; online is optional).
  payment: model.enum(["deposit", "full", "none"]).default("deposit"),
  deposit_type: model.enum(["fixed", "percent"]).default("fixed"),
  deposit_value: model.float().default(0),
  active: model.boolean().default(true),
  sort: model.number().default(0),
})

export default BookingService
