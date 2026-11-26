import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { DEVICE_HEADER, deviceIdFrom } from "../../../../../lib/device-code"
import { verifyDeviceCodeWorkflow } from "../../../../../workflows/device-code"
import type { VerifyDeviceCodeBody } from "../../../validators"

/** POST /sellers/me/device-code/verify { code }: the right code makes this a trusted device. */
export async function POST(req: AuthenticatedMedusaRequest<VerifyDeviceCodeBody>, res: MedusaResponse) {
  const device = deviceIdFrom(req.headers[DEVICE_HEADER])
  if (!device) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Update the AQUENORA app to sign in.")
  await verifyDeviceCodeWorkflow(req.scope).run({ input: { seller_id: req.auth_context.actor_id, device, code: req.validatedBody.code } })
  res.json({ trusted: true })
}
