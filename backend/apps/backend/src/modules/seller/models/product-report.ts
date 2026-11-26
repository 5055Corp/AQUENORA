import { model } from "@medusajs/framework/utils"

/** A shopper reported a product (counterfeit, not allowed...). AQUENORA reviews it in the admin. */
const ProductReport = model.define("product_report", {
  id: model.id({ prefix: "prep" }).primaryKey(),
  product_id: model.text().index(),
  seller_id: model.text().index(),
  reason: model.enum(["counterfeit", "prohibited", "misleading", "offensive", "scam", "other"]),
  note: model.text().nullable(),
  status: model.enum(["open", "actioned", "dismissed"]).default("open"),
})

export default ProductReport
