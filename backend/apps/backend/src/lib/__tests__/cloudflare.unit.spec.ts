import http from "node:http"
import type { AddressInfo } from "node:net"
import { cloudflareEnabled, ensureCustomHostname, removeCustomHostname } from "../cloudflare"

// A fake Cloudflare custom hostnames API for one zone.
const hosts = new Map<string, { id: string; hostname: string; status: string; ssl: { status: string } }>()
const calls: string[] = []
const server = http.createServer((req, res) => {
  let body = ""
  req.on("data", (c) => (body += c))
  req.on("end", () => {
    calls.push(`${req.method} ${req.url}`)
    const send = (json: unknown) => {
      res.writeHead(200, { "content-type": "application/json" })
      res.end(JSON.stringify(json))
    }
    if (req.headers.authorization !== "Bearer cf_test") return send({ success: false, errors: [{ code: 10000, message: "Authentication error" }], result: null })
    const url = new URL(req.url!, "http://x")
    if (req.method === "GET") return send({ success: true, result: [...hosts.values()].filter((h) => h.hostname === url.searchParams.get("hostname")) })
    if (req.method === "POST") {
      const { hostname } = JSON.parse(body)
      const h = { id: "ch_" + hosts.size, hostname, status: "pending", ssl: { status: "pending_validation" } }
      hosts.set(h.id, h)
      return send({ success: true, result: h })
    }
    if (req.method === "DELETE") {
      hosts.delete(url.pathname.split("/").pop()!)
      return send({ success: true, result: {} })
    }
  })
})

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r))
  process.env.CLOUDFLARE_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))
afterEach(() => {
  delete process.env.CLOUDFLARE_API_TOKEN
  delete process.env.CLOUDFLARE_ZONE_ID
})

describe("Cloudflare custom hostnames", () => {
  it("does nothing until the token and zone are set", async () => {
    expect(cloudflareEnabled()).toBe(false)
    expect(await ensureCustomHostname("adirehouse.com")).toBe("off")
    expect(calls).toHaveLength(0)
  })

  it("adds www.<domain> once, reports HTTPS progress, and removes it", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf_test"
    process.env.CLOUDFLARE_ZONE_ID = "zone1"
    expect(await ensureCustomHostname("adirehouse.com")).toBe("pending")
    expect(await ensureCustomHostname("adirehouse.com")).toBe("pending")
    expect([...hosts.values()].map((h) => h.hostname)).toEqual(["www.adirehouse.com"])
    expect(calls.filter((c) => c.startsWith("POST"))).toEqual(["POST /zones/zone1/custom_hostnames"])

    // Cloudflare finishes the certificate.
    const h = [...hosts.values()][0]
    h.status = "active"
    h.ssl.status = "active"
    expect(await ensureCustomHostname("adirehouse.com")).toBe("active")

    await removeCustomHostname("adirehouse.com")
    expect(hosts.size).toBe(0)
  })

  it("passes on Cloudflare's error for a wrong token", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "wrong"
    process.env.CLOUDFLARE_ZONE_ID = "zone1"
    await expect(ensureCustomHostname("adirehouse.com")).rejects.toThrow("Authentication error")
  })
})
