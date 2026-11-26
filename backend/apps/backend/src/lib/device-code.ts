// Sign-in safety: a seller signing in on a new phone or computer confirms it with a 6-digit code
// emailed to them. Devices are identified by a random id the app keeps (header x-aq-device).

import { createHash, randomInt, timingSafeEqual } from "node:crypto"
import { supportEmail } from "./account-email"

export const DEVICE_HEADER = "x-aq-device"
export const CODE_TTL_MS = 10 * 60 * 1000
export const RESEND_AFTER_MS = 60 * 1000
export const MAX_SENDS_PER_HOUR = 5
export const MAX_ATTEMPTS = 5
export const MAX_DEVICES = 10

export type TrustedDevice = { hash: string; at: string }
export type DeviceCode = { hash: string; device: string; expires_at: string; attempts: number; sends: string[] }

const secret = () => process.env.JWT_SECRET || "supersecret"
const sha = (s: string) => createHash("sha256").update(`${secret()}:${s}`).digest("hex")

/** A valid device id from the request header, or null. */
export function deviceIdFrom(header: unknown): string | null {
  const v = Array.isArray(header) ? header[0] : header
  return typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v) ? v : null
}

export const deviceHash = (id: string) => sha(`device:${id}`)
export const codeHash = (sellerId: string, code: string) => sha(`code:${sellerId}:${code}`)
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0")

export function isTrusted(devices: TrustedDevice[] | null | undefined, id: string): boolean {
  const h = deviceHash(id)
  return (devices ?? []).some((d) => d.hash === h)
}

export function withDevice(devices: TrustedDevice[] | null | undefined, id: string, now = new Date()): TrustedDevice[] {
  const h = deviceHash(id)
  return [...(devices ?? []).filter((d) => d.hash !== h), { hash: h, at: now.toISOString() }].slice(-MAX_DEVICES)
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex")
  const y = Buffer.from(b, "hex")
  return x.length === y.length && timingSafeEqual(x, y)
}

/** a***@gmail.com */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@")
  return `${user.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(user.length - 1, 6)))}@${domain}`
}

export function deviceCodeEmail(input: { to: string; code: string; shopName: string; device: string }) {
  const subject = `${input.code} is your AQUENORA sign-in code`
  const text = `Someone is signing in to ${input.shopName} on AQUENORA from a new device${input.device ? ` (${input.device})` : ""}.

Your code: ${input.code}

It works for 10 minutes. If this wasn't you, don't share the code: change your password in the app and write to ${supportEmail()}.

AQUENORA`
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;"><div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:22px;text-align:center;font-weight:800;letter-spacing:4px;font-size:20px;">AQUENORA</div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;">
<h1 style="font-size:20px;margin:0 0 10px;">Your sign-in code</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Someone is signing in to <b>${input.shopName.replace(/</g, "&lt;")}</b> from a new device${input.device ? ` (${input.device.replace(/</g, "&lt;")})` : ""}. Enter this code in the app:</p>
<div style="font-size:34px;font-weight:800;letter-spacing:10px;text-align:center;background:#f1ebfd;color:#3b1680;border-radius:14px;padding:16px 0;margin:0 0 16px;">${input.code}</div>
<p style="font-size:13px;color:#6b645a;margin:0;">It works for 10 minutes. If this wasn't you, don't share the code: change your password and write to ${supportEmail()}.</p>
</div></div></body></html>`
  return { to: input.to, subject, text, html }
}
