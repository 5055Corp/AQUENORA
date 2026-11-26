import { model } from "@medusajs/framework/utils"

/**
 * "Notify me when it's back": a shopper's email waiting for a sold-out product (or one choice of it,
 * e.g. the 22 inch). Emailed once when the seller restocks, then marked sent.
 */
const StockAlert = model.define("stock_alert", {
  id: model.id({ prefix: "salt" }).primaryKey(),
  product_id: model.text().index(),
  seller_id: model.text().index(),
  email: model.text(),
  /** The first option's choice they want (stock per choice), or "" for the product. */
  choice: model.text().default(""),
  status: model.enum(["waiting", "sent"]).default("waiting"),
})

export default StockAlert
