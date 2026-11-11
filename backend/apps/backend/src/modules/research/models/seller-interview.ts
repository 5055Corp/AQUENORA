import { model } from "@medusajs/framework/utils"

/**
 * One answered seller interview (app.aquenora.com/interview): market research from potential
 * sellers. `answers` keeps each question's wording next to the answer, so old responses stay
 * readable when the questions change.
 */
const SellerInterview = model.define("seller_interview", {
  id: model.id({ prefix: "intv" }).primaryKey(),
  // [{ id, section, question, answer }]; answer is text or a list of choices.
  answers: model.json(),
  // Optional contact details, kept only if the seller agreed to be contacted.
  name: model.text().nullable(),
  email: model.text().nullable(),
  phone: model.text().nullable(),
  contact_ok: model.boolean().default(false),
  wants_early_access: model.boolean().default(false),
  country: model.text().nullable(),
  // Where the link was shared (?ref=instagram etc.), and the survey version.
  source: model.text().nullable(),
  version: model.text(),
})

export default SellerInterview
