import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../../../../modules/seller"
import type SellerModuleService from "../../../../../../modules/seller/service"

/** GET /admin/verifications/:id/documents/:doc: one private document, for AQUENORA admins only. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const [doc] = await sellers.listSellerDocuments({ id: req.params.doc, seller_id: req.params.id }, { take: 1 })
  if (!doc) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Document not found.")
  res.setHeader("Content-Type", doc.mime_type)
  res.setHeader("Cache-Control", "private, no-store")
  res.setHeader("Content-Disposition", `inline; filename="${doc.kind}"`)
  res.send(Buffer.from(doc.data, "base64"))
}
