// Push notifications to sellers' iPhones, sent straight to Apple (APNs) with the .p8 key.
// Railway variables: APNS_KEY (the .p8 file's contents), APNS_KEY_ID, APNS_TEAM_ID,
// APNS_BUNDLE_ID (com.aquenora.seller), APNS_SANDBOX=true only for Xcode test builds.
// Without them nothing is sent (and nothing fails).

import { createPrivateKey, sign } from "node:crypto"
import http2 from "node:http2"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

export type PushToken = { token: string; at: string }
export type PushMessage = { title: string; body: string; /** Which tab to open: orders, products... */ tab?: string }

export const pushEnabled = () => !!(process.env.APNS_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID)

export function withPushToken(tokens: PushToken[] | null | undefined, token: string, now = new Date()): PushToken[] {
  return [...(tokens ?? []).filter((t) => t.token !== token), { token, at: now.toISOString() }].slice(-5)
}

const b64 = (v: Buffer | string) => Buffer.from(v).toString("base64url")
let cached: { jwt: string; at: number } | null = null

/** Apple's provider token (ES256 JWT), reused for 50 minutes. */
export function providerToken(): string {
  if (cached && Date.now() - cached.at < 50 * 60 * 1000) return cached.jwt
  const header = b64(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID }))
  const claims = b64(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }))
  const key = createPrivateKey((process.env.APNS_KEY ?? "").replace(/\\n/g, "\n"))
  const sig = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" })
  cached = { jwt: `${header}.${claims}.${b64(sig)}`, at: Date.now() }
  return cached.jwt
}

/** Sends one notification to each token; returns the tokens Apple says are no longer valid. */
async function sendToApple(tokens: string[], msg: PushMessage): Promise<string[]> {
  const host = process.env.APNS_SANDBOX === "true" ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com"
  const client = http2.connect(host)
  const dead: string[] = []
  try {
    await Promise.all(
      tokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const req = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              authorization: `bearer ${providerToken()}`,
              "apns-topic": process.env.APNS_BUNDLE_ID || "com.aquenora.seller",
              "apns-push-type": "alert",
              "content-type": "application/json",
            })
            let status = 0
            let body = ""
            req.on("response", (h) => { status = Number(h[":status"]) })
            req.on("data", (c) => { body += c })
            req.on("end", () => {
              if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(body))) dead.push(token)
              resolve()
            })
            req.on("error", () => resolve())
            req.setTimeout(10000, () => { req.close(); resolve() })
            req.end(JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: "default" }, tab: msg.tab ?? "home" }))
          })
      )
    )
  } finally {
    client.close()
  }
  return dead
}

/** Tells a seller's iPhones. Never throws: a failed notification never breaks an order. */
export async function pushToSeller(container: MedusaContainer, sellerId: string, msg: PushMessage): Promise<void> {
  if (!pushEnabled()) return
  try {
    const sellers = container.resolve<SellerModuleService>(SELLER_MODULE)
    const s = (await sellers.retrieveSeller(sellerId, { select: ["id", "push_tokens"] })) as unknown as { push_tokens: PushToken[] | null }
    const tokens = (s.push_tokens ?? []).map((t) => t.token)
    if (!tokens.length) return
    const dead = await sendToApple(tokens, msg)
    if (dead.length) {
      // Forget phones that uninstalled the app or turned notifications off for good.
      await sellers.updateSellers({ id: sellerId, push_tokens: (s.push_tokens ?? []).filter((t) => !dead.includes(t.token)) } as never)
    }
  } catch (e) {
    container.resolve(ContainerRegistrationKeys.LOGGER).warn(`Push notification not sent: ${e instanceof Error ? e.message : e}`)
  }
}
