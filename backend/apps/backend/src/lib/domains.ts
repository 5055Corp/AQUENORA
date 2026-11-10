// Sellers' own domains (Pro). The seller buys a domain anywhere, points it at AQENORA with the
// records below, and AQENORA checks DNS until it's connected.

import { promises as dns } from "node:dns"

/** Where sellers point their domain (the web server's hostname / IP, set when hosting). */
export function dnsTargets() {
  return {
    cname: (process.env.STORE_CNAME_TARGET || "stores.aqenora.com").toLowerCase().replace(/\.$/, ""),
    ip: process.env.STORE_IP || "",
  }
}

/** "https://www.AdireHouse.com/" -> "adirehouse.com". Returns null for anything that isn't a plain domain. */
export function normalizeDomain(input: string): string | null {
  const d = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "").replace(/\.$/, "")
  if (d.length > 253 || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) {
    return null
  }
  const root = (process.env.STORE_DOMAIN || "aqenora.com").toLowerCase()
  if (d === root || d.endsWith("." + root)) {
    return null
  }
  return d
}

/** The DNS records the seller adds at their domain shop. */
export function dnsRecords(domain: string) {
  const { cname, ip } = dnsTargets()
  return [
    { type: "CNAME", host: "www", value: cname, note: `Makes www.${domain} open your store.` },
    ip
      ? { type: "A", host: "@", value: ip, note: `Makes ${domain} (without www) open your store.` }
      : { type: "Forwarding", host: "@", value: `https://www.${domain}`, note: `Most domain shops call this "URL forwarding" or "redirect". It sends ${domain} to www.${domain}.` },
  ]
}

/** True when www.<domain> (or the domain itself) points at AQENORA. */
export async function domainPointsHere(domain: string): Promise<boolean> {
  const { cname, ip } = dnsTargets()
  for (const host of [`www.${domain}`, domain]) {
    try {
      const names = await dns.resolveCname(host)
      if (names.some((n) => n.toLowerCase().replace(/\.$/, "") === cname)) {
        return true
      }
    } catch {
      /* no CNAME */
    }
    if (ip) {
      try {
        if ((await dns.resolve4(host)).includes(ip)) {
          return true
        }
      } catch {
        /* no A record */
      }
    }
  }
  return false
}

/** Link to search for a domain at Namecheap, filled in with the shop's name. */
export function buyDomainUrl(handle: string): string {
  return `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(handle)}`
}
