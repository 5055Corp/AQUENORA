import { model } from "@medusajs/framework/utils"

/** A photo attached to a dispute (buyer's evidence or the seller's refund proof). Private: never in public storage. */
const DisputeFile = model.define("dispute_file", {
  id: model.id({ prefix: "dfil" }).primaryKey(),
  dispute_id: model.text().index(),
  from: model.enum(["buyer", "seller"]),
  mime_type: model.text(),
  /** base64, already shrunk by the browser. */
  data: model.text(),
})

export default DisputeFile
