import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { toDisputeView, type DisputeRecord } from "./disputes"

export async function disputeForOrder(container: MedusaContainer, orderId: string): Promise<DisputeRecord | null> {
  const [d] = await container.resolve<SellerModuleService>(SELLER_MODULE).listDisputes({ order_id: orderId })
  return (d as unknown as DisputeRecord) ?? null
}

export const disputeView = (d: DisputeRecord | null) => (d ? toDisputeView(d) : null)

/** Sends a dispute photo, only if it belongs to that dispute. Never cached by browsers or proxies. */
export async function sendDisputeFile(container: MedusaContainer, disputeId: string, fileId: string, res: MedusaResponse) {
  const [f] = await container.resolve<SellerModuleService>(SELLER_MODULE).listDisputeFiles({ id: fileId, dispute_id: disputeId })
  if (!f) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found.")
  res.setHeader("Content-Type", f.mime_type)
  res.setHeader("Cache-Control", "private, no-store")
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.send(Buffer.from(f.data, "base64"))
}
