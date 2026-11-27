import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { DEVICE_HEADER, deviceIdFrom } from "../../../../lib/device-code"
import { sendDeviceCodeWorkflow } from "../../../../workflows/device-code"
import type { DeviceCodeBody } from "../../validators"

/** POST /sellers/me/device-code { device_name? }: email a 6-digit code to confirm this new device. */
export async function POST(req: AuthenticatedMedusaRequest<DeviceCodeBody>, res: MedusaResponse) {
  const device = deviceIdFrom(req.headers[DEVICE_HEADER])
  if (!device) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Update the AQUENORA app to sign in.")
  const { result } = await sendDeviceCodeWorkflow(req.scope).run({
    input: { seller_id: req.auth_context.actor_id, device, device_name: req.validatedBody.device_name ?? "" },
  })
  res.json({ sent_to: result })
}
