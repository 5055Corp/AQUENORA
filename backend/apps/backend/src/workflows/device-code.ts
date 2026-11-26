import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { supportEmail } from "../lib/account-email"
import {
  CODE_TTL_MS, codeHash, deviceCodeEmail, deviceHash, type DeviceCode, MAX_ATTEMPTS, MAX_SENDS_PER_HOUR, maskEmail, newCode,
  RESEND_AFTER_MS, sameHash, type TrustedDevice, withDevice,
} from "../lib/device-code"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

type SellerSafety = { id: string; email: string; name: string; trusted_devices: TrustedDevice[] | null; device_code: DeviceCode | null }
const load = async (sellers: SellerModuleService, id: string) => (await sellers.retrieveSeller(id)) as unknown as SellerSafety

// ---------------- a seller's first device is trusted (sign-up, or the first sign-in after this update) ----------------

const trustFirstDeviceStep = createStep("trust-first-device", async (input: { seller_id: string; device: string }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const s = await load(sellers, input.seller_id)
  if (s.trusted_devices?.length) return new StepResponse(false)
  await sellers.updateSellers({ id: s.id, trusted_devices: withDevice(null, input.device) } as never)
  return new StepResponse(true)
})

export const trustFirstDeviceWorkflow = createWorkflow("trust-first-device", function (input: { seller_id: string; device: string }) {
  return new WorkflowResponse(trustFirstDeviceStep(input))
})

// ---------------- email a code ----------------

const makeDeviceCodeStep = createStep("make-device-code", async (input: { seller_id: string; device: string; device_name: string }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const s = await load(sellers, input.seller_id)
  const now = Date.now()
  const sends = (s.device_code?.sends ?? []).filter((at) => now - new Date(at).getTime() < 60 * 60 * 1000)
  const last = sends[sends.length - 1]
  if (last && now - new Date(last).getTime() < RESEND_AFTER_MS) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "We just sent a code. Wait a minute before asking for another.")
  }
  if (sends.length >= MAX_SENDS_PER_HOUR) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Too many codes. Try again in an hour, or write to support.")
  }
  const code = newCode()
  const record: DeviceCode = {
    hash: codeHash(s.id, code),
    device: deviceHash(input.device),
    expires_at: new Date(now + CODE_TTL_MS).toISOString(),
    attempts: 0,
    sends: [...sends, new Date(now).toISOString()],
  }
  await sellers.updateSellers({ id: s.id, device_code: record } as never)
  return new StepResponse({ mail: deviceCodeEmail({ to: s.email, code, shopName: s.name, device: input.device_name }), sent_to: maskEmail(s.email) })
})

export const sendDeviceCodeWorkflow = createWorkflow("send-device-code", function (input: { seller_id: string; device: string; device_name: string }) {
  const made = makeDeviceCodeStep(input)
  const notifications = transform({ made }, ({ made }) => [
    { to: made.mail.to, channel: "email", template: "aquenora-login-code", data: { subject: made.mail.subject, text: made.mail.text, html: made.mail.html, reply_to: supportEmail() } },
  ])
  sendNotificationsStep(notifications)
  return new WorkflowResponse(transform({ made }, ({ made }) => made.sent_to))
})

// ---------------- check the code ----------------

const verifyDeviceCodeStep = createStep("verify-device-code", async (input: { seller_id: string; device: string; code: string }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const s = await load(sellers, input.seller_id)
  const c = s.device_code
  if (!c || c.device !== deviceHash(input.device) || new Date(c.expires_at).getTime() < Date.now() || c.attempts >= MAX_ATTEMPTS) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "That code has expired. Ask for a new one.")
  }
  if (!sameHash(c.hash, codeHash(s.id, input.code))) {
    const attempts = c.attempts + 1
    await sellers.updateSellers({ id: s.id, device_code: { ...c, attempts } } as never)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      attempts >= MAX_ATTEMPTS ? "Too many wrong codes. Ask for a new one." : `That code isn't right. ${MAX_ATTEMPTS - attempts} ${MAX_ATTEMPTS - attempts === 1 ? "try" : "tries"} left.`
    )
  }
  await sellers.updateSellers({ id: s.id, trusted_devices: withDevice(s.trusted_devices, input.device), device_code: { ...c, hash: "", attempts: MAX_ATTEMPTS } } as never)
  return new StepResponse(true)
})

export const verifyDeviceCodeWorkflow = createWorkflow("verify-device-code", function (input: { seller_id: string; device: string; code: string }) {
  return new WorkflowResponse(verifyDeviceCodeStep(input))
})
