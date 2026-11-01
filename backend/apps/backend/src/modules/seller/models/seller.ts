import { model } from "@medusajs/framework/utils"

/**
 * A seller's store on AQENORA. One seller = one shop at <handle>.aqenora.com.
 * The seller's login lives in the auth module and points here through
 * `app_metadata.seller_id` (actor type "seller").
 */
const Seller = model.define("seller", {
  id: model.id({ prefix: "sel" }).primaryKey(),
  email: model.text(),
  name: model.text().searchable(),
  handle: model.text().unique(),
  category: model.text().default("Fashion & clothing"),
  // NG, GH, ZA, CI, SN, or DI for a diaspora seller abroad
  country_code: model.enum(["NG", "GH", "ZA", "CI", "SN", "DI"]).default("NG"),
  currency_code: model.text().default("ngn"),
  sells_abroad: model.boolean().default(true),
  // Filled in once the seller connects Paystack (split payments come in a later step)
  paystack_subaccount_code: model.text().nullable(),
  theme: model.enum(["harmattan", "lagos", "savanna"]).default("harmattan"),
  accent: model.enum(["terracotta", "leaf", "indigo", "hibiscus"]).default("terracotta"),
  font: model.enum(["classic", "modern", "friendly"]).default("classic"),
  announcement: model.text().nullable(),
  onboarding_completed: model.boolean().default(false),
})

export default Seller
