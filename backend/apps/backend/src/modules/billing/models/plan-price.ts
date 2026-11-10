import { model } from "@medusajs/framework/utils"

/** The Pro plan's monthly price in one country, set by the AQENORA team in the admin dashboard. */
const PlanPrice = model.define("plan_price", {
  id: model.id({ prefix: "pprice" }).primaryKey(),
  country_code: model.text().unique(),
  currency_code: model.text(),
  // Whole units of the currency, e.g. 38500 = NGN 38,500 a month.
  monthly_price: model.number(),
})

export default PlanPrice
