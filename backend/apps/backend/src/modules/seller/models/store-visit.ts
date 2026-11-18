import { model } from "@medusajs/framework/utils"

/**
 * How many times a store page was opened, per day and per source (WhatsApp, Instagram...).
 * Only counts: no visitor, device or address is stored.
 */
const StoreVisit = model.define("store_visit", {
  id: model.id({ prefix: "svis" }).primaryKey(),
  seller_id: model.text().index(),
  /** YYYY-MM-DD (UTC). */
  day: model.text(),
  source: model.text(),
  count: model.number().default(0),
})

export default StoreVisit
