import { model } from "@medusajs/framework/utils"

/** An email blast that sends again every week or month (the job "send-scheduled-campaigns" sends it). */
const MarketingSchedule = model.define("marketing_schedule", {
  id: model.id({ prefix: "msch" }).primaryKey(),
  seller_id: model.text().index(),
  subject: model.text(),
  message: model.text(),
  audience: model.enum(["all", "repeat", "lapsed"]),
  every: model.enum(["week", "month"]),
  next_run_at: model.dateTime().index(),
  active: model.boolean().default(true),
  last_sent_at: model.dateTime().nullable(),
  last_error: model.text().nullable(),
})

export default MarketingSchedule
