import { model } from "@medusajs/framework/utils"

/**
 * A buyer's problem with an order (didn't arrive, wrong item...). Sellers refund buyers directly
 * (AQUENORA never pays out refunds); AQUENORA can step in and decide.
 *
 * status: open (waiting for the seller) -> replied | refunded (seller marked it refunded) ->
 *         resolved (buyer confirmed, or AQUENORA closed it). escalated = buyer asked AQUENORA to help.
 * messages: [{ from: "buyer" | "seller" | "aquenora", text, at, files?: [id] }]
 * refund:   { amount, note, at, file?: id }   (what the seller says they sent back)
 * decision: { outcome: "refund_required" | "seller", note, amount?, due?, at }
 */
const Dispute = model.define("dispute", {
  id: model.id({ prefix: "disp" }).primaryKey(),
  order_id: model.text().unique(),
  seller_id: model.text().index(),
  order_display_id: model.number(),
  buyer_email: model.text(),
  buyer_name: model.text().nullable(),
  reason: model.enum(["not_arrived", "wrong_item", "damaged", "not_as_described", "other"]),
  status: model.enum(["open", "replied", "refunded", "escalated", "resolved"]).default("open"),
  messages: model.json(),
  refund: model.json().nullable(),
  decision: model.json().nullable(),
  /** The seller should reply by this time (2 working days). */
  reply_by: model.dateTime(),
  resolved_at: model.dateTime().nullable(),
})

export default Dispute
