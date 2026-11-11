import { model } from "@medusajs/framework/utils"

/**
 * One buyer checkout sent to Paystack. Keeps what the buyer ordered (prices as shown at checkout)
 * until Paystack confirms the payment; then exactly one order is created and order_id is set.
 * The reference is unique, so the webhook and the buyer's return page can't create two orders.
 */
const Checkout = model.define("checkout", {
  id: model.id({ prefix: "chk" }).primaryKey(),
  reference: model.text().unique(),
  seller_id: model.text().index(),
  // "pending" until paid, then "paid".
  status: model.enum(["pending", "paid"]).default("pending"),
  currency_code: model.text(),
  /** Total in the seller's currency (whole units). */
  amount: model.bigNumber(),
  /** AQUENORA's commission (whole units) and its rate, fixed at checkout. */
  platform_fee: model.bigNumber(),
  commission_rate: model.float(),
  /** Buyer, items and delivery or pickup (see api/store/sellers/[handle]/checkout). */
  data: model.json(),
  order_id: model.text().nullable(),
})

export default Checkout
