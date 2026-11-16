import { model } from "@medusajs/framework/utils"

/**
 * A private verification document (CAC certificate, government ID, selfie). Kept in the database,
 * never in the public file storage, and only readable by AQUENORA admins.
 */
const SellerDocument = model.define("seller_document", {
  id: model.id({ prefix: "sdoc" }).primaryKey(),
  seller_id: model.text().index(),
  kind: model.enum(["cac", "id", "selfie"]),
  mime_type: model.text(),
  /** base64, already shrunk by the app. */
  data: model.text(),
})

export default SellerDocument
