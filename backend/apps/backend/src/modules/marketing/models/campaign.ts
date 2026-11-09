import { model } from "@medusajs/framework/utils"

/** An email a seller sent to a group of past buyers. */
const MarketingCampaign = model.define("marketing_campaign", {
  id: model.id({ prefix: "mcmp" }).primaryKey(),
  seller_id: model.text(),
  subject: model.text(),
  message: model.text(),
  // all = everyone who said yes; repeat = bought 2+ times; lapsed = no order in 60+ days
  audience: model.enum(["all", "repeat", "lapsed"]),
  recipient_count: model.number().default(0),
  sent_count: model.number().default(0),
  failed_count: model.number().default(0),
  sent_at: model.dateTime().nullable(),
})

export default MarketingCampaign
