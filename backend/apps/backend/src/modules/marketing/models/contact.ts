import { model } from "@medusajs/framework/utils"

/**
 * A buyer's email permission for one shop. Campaigns only go to contacts with subscribed = true,
 * which only happens when the buyer ticked "Send me news and offers from this shop" at checkout.
 */
const MarketingContact = model
  .define("marketing_contact", {
    id: model.id({ prefix: "mcon" }).primaryKey(),
    seller_id: model.text(),
    email: model.text(),
    name: model.text().nullable(),
    subscribed: model.boolean().default(false),
    consented_at: model.dateTime().nullable(),
    unsubscribed_at: model.dateTime().nullable(),
    // Secret in every email's unsubscribe link; works without logging in.
    unsubscribe_token: model.text().unique(),
  })
  .indexes([{ on: ["seller_id", "email"], unique: true }])

export default MarketingContact
