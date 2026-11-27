import type { AuthenticatedMedusaRequest, MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { authenticate } from "@medusajs/framework/http"
import { DEVICE_HEADER, deviceIdFrom, isTrusted, type TrustedDevice } from "../lib/device-code"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { trustFirstDeviceWorkflow } from "../workflows/device-code"

const sellerAuth = authenticate("seller", ["bearer", "session"])

/**
 * Every /sellers/me request must come from a device the seller has confirmed with an emailed code.
 * A seller's first device is trusted automatically. Older app versions don't send a device id;
 * they're let through until REQUIRE_DEVICE_CODE=true is set (once everyone has the new app).
 */
export function deviceGuard(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const path = (req.originalUrl ?? req.url).split("?")[0]
  if (req.method === "OPTIONS" || /^\/sellers\/me\/device-code(\/|$)/.test(path)) return next()
  sellerAuth(req, res, async (err?: unknown) => {
    if (err) return next(err)
    try {
      const sellerId = (req as AuthenticatedMedusaRequest).auth_context?.actor_id
      if (!sellerId) return next()
      const device = deviceIdFrom(req.headers[DEVICE_HEADER])
      if (!device) {
        if (process.env.REQUIRE_DEVICE_CODE === "true") {
          return res.status(403).json({ type: "update_required", message: "Update the AQUENORA app to keep using your store." })
        }
        return next()
      }
      const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
      const seller = (await sellers.retrieveSeller(sellerId, { select: ["id", "trusted_devices"] })) as unknown as { trusted_devices: TrustedDevice[] | null }
      if (!seller.trusted_devices?.length) {
        await trustFirstDeviceWorkflow(req.scope).run({ input: { seller_id: sellerId, device } })
        return next()
      }
      if (isTrusted(seller.trusted_devices, device)) return next()
      return res.status(403).json({ type: "device_unverified", message: "Confirm this device with the code we email you." })
    } catch (e) {
      return next(e)
    }
  })
}
