// Order tracking for buyers, without an account.
//
// A tracking link carries the order id plus a signature made with the server's secret, so only
// someone with the link (the buyer, from their confirmation email or the thank-you page) can see
// the order. Nothing is stored for it, so it works for every order, old and new.

import { createHmac, timingSafeEqual } from "node:crypto"
import { shopUrl } from "./campaign-email"

function secret(): string {
  const s = process.env.ORDER_TRACKING_SECRET || process.env.JWT_SECRET || process.env.COOKIE_SECRET
  if (s) return s
  if (process.env.NODE_ENV === "production") throw new Error("Set JWT_SECRET (used to sign order tracking links).")
  return "dev-order-tracking-secret"
}

const sign = (orderId: string) => createHmac("sha256", secret()).update(`track:${orderId}`).digest("base64url").slice(0, 24)

/** "<order id>.<signature>" */
export function trackToken(orderId: string): string {
  return `${orderId}.${sign(orderId)}`
}

/** The order id if the token is genuine, else null. */
export function orderIdFromToken(token: string): string | null {
  const dot = token.lastIndexOf(".")
  if (dot <= 0) return null
  const id = token.slice(0, dot)
  const given = Buffer.from(token.slice(dot + 1))
  const want = Buffer.from(sign(id))
  return given.length === want.length && timingSafeEqual(given, want) ? id : null
}

/** The shop's page with ?track=..., which shows the order's progress. */
export function trackUrl(handle: string, orderId: string): string | null {
  const shop = shopUrl(handle)
  if (!shop) return null
  return `${shop}${shop.includes("?") ? "&" : "?"}track=${encodeURIComponent(trackToken(orderId))}`
}
