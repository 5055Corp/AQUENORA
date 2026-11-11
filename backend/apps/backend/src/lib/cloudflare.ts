// Cloudflare for SaaS: makes sellers' own domains (www.adirehouse.com) load over HTTPS.
// When a seller's domain points at AQUENORA, it is added as a "custom hostname" on the aquenora.com
// zone; Cloudflare then issues its certificate and sends its traffic to the fallback origin
// (stores.aquenora.com). Without CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID this does nothing,
// and hostnames can be added by hand in the Cloudflare dashboard.
//
// The API token needs one permission: Zone -> SSL and Certificates -> Edit, for aquenora.com.

import { MedusaError } from "@medusajs/framework/utils"

const apiUrl = () => (process.env.CLOUDFLARE_API_URL || "https://api.cloudflare.com/client/v4").replace(/\/$/, "")
const token = () => process.env.CLOUDFLARE_API_TOKEN || ""
const zone = () => process.env.CLOUDFLARE_ZONE_ID || ""

export const cloudflareEnabled = () => !!token() && !!zone()

/** "active": the domain works over HTTPS. "pending": Cloudflare is still issuing the certificate. */
export type HttpsStatus = "active" | "pending" | "error" | "off"

type CustomHostname = {
  id: string
  hostname: string
  status: string
  ssl?: { status?: string; validation_errors?: { message: string }[] }
}
type CfResponse<T> = { success: boolean; errors?: { code: number; message: string }[]; result: T }

async function call<T>(method: string, path: string, body?: unknown): Promise<CfResponse<T>> {
  const res = await fetch(`${apiUrl()}/zones/${encodeURIComponent(zone())}${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  const json = (await res.json().catch(() => null)) as CfResponse<T> | null
  if (!json) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Cloudflare answered ${res.status}`)
  }
  return json
}

async function find(hostname: string): Promise<CustomHostname | null> {
  const r = await call<CustomHostname[]>("GET", `/custom_hostnames?hostname=${encodeURIComponent(hostname)}`)
  return r.success ? r.result.find((h) => h.hostname === hostname) ?? null : null
}

const statusOf = (h: CustomHostname): HttpsStatus =>
  h.status === "active" && h.ssl?.status === "active"
    ? "active"
    : h.ssl?.validation_errors?.length || ["blocked", "moved", "deleted"].includes(h.status)
      ? "error"
      : "pending"

/** Adds www.<domain> to Cloudflare (once) and returns how far its HTTPS setup is. */
export async function ensureCustomHostname(domain: string): Promise<HttpsStatus> {
  if (!cloudflareEnabled()) {
    return "off"
  }
  const hostname = `www.${domain}`
  const existing = await find(hostname)
  if (existing) {
    return statusOf(existing)
  }
  const r = await call<CustomHostname>("POST", "/custom_hostnames", {
    hostname,
    ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
  })
  if (!r.success) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, r.errors?.map((e) => e.message).join("; ") || "Cloudflare refused the hostname")
  }
  return statusOf(r.result)
}

/** Removes www.<domain> from Cloudflare when a seller disconnects it. */
export async function removeCustomHostname(domain: string): Promise<void> {
  if (!cloudflareEnabled()) {
    return
  }
  const existing = await find(`www.${domain}`)
  if (existing) {
    await call("DELETE", `/custom_hostnames/${encodeURIComponent(existing.id)}`)
  }
}
