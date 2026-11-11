import { model } from "@medusajs/framework/utils"

/**
 * A seller's store on AQUENORA. One seller = one shop at <handle>.aquenora.com.
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
  // The seller's Paystack subaccount: sales settle to their bank, minus AQUENORA's commission and
  // Paystack's fee (see lib/paystack.ts). Set by POST /sellers/me/payouts.
  paystack_subaccount_code: model.text().nullable(),
  // What the seller sees about their payout account: { bank_name, bank_code, account_last4, account_name }.
  payout: model.json().nullable(),
  theme: model.enum(["harmattan", "lagos", "savanna"]).default("harmattan"),
  accent: model.enum(["terracotta", "leaf", "indigo", "hibiscus"]).default("terracotta"),
  font: model.enum(["classic", "modern", "friendly"]).default("classic"),
  announcement: model.text().nullable(),
  // Full store design (colours, fonts, layout, banner, about, social links); see design.ts.
  // When empty, the store uses theme/accent/font/announcement above.
  design: model.json().nullable(),
  // In-store pickup: address, area, opening hours per day, instructions (see pickup.ts).
  pickup: model.json().nullable(),
  // Ship-from address and delivery options (DHL, FedEx, UPS... with the seller's flat rates); see shipping.ts.
  shipping: model.json().nullable(),
  onboarding_completed: model.boolean().default(false),
  // ---- plan ----
  // Pro is active while either date is in the future. A trial keeps the "Powered by AQUENORA" badge.
  trial_ends_at: model.dateTime().nullable(),
  pro_paid_until: model.dateTime().nullable(),
  // Pro by card (see lib/pro-billing.ts): the saved Paystack card and renewal state.
  // { authorization_code, signature, email, brand, last4, exp_month, exp_year, auto_renew,
  //   failures, last_error, last_attempt_at }
  pro_billing: model.json().nullable(),
  // ---- own domain (Pro) ----
  custom_domain: model.text().nullable(),
  domain_verified_at: model.dateTime().nullable(),
})

export default Seller
