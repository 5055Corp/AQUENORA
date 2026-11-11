// Exchange rates for showing prices in buyers' currencies (display only: payment is always in
// the seller's currency). Fetched from EXCHANGE_RATES_URL (default: open.er-api.com, free, no key)
// at most every 12 hours; built-in approximate rates are used if that fails.

import { FALLBACK_RATES } from "./countries"

const TTL = 12 * 3600 * 1000
type Rates = { base: "USD"; rates: Record<string, number>; source: "live" | "fallback"; updated_at: string }

let cache: { at: number; value: Rates } | null = null

export async function getRates(now = Date.now()): Promise<Rates> {
  if (cache && now - cache.at < TTL) {
    return cache.value
  }
  const url = process.env.EXCHANGE_RATES_URL ?? "https://open.er-api.com/v6/latest/USD"
  let value: Rates = { base: "USD", rates: FALLBACK_RATES, source: "fallback", updated_at: new Date(now).toISOString() }
  if (url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      const json = (await res.json()) as { rates?: Record<string, unknown>; time_last_update_utc?: string }
      const rates = Object.fromEntries(
        Object.entries(json.rates ?? {}).filter(([k, v]) => /^[A-Z]{3}$/.test(k) && typeof v === "number" && v > 0)
      ) as Record<string, number>
      if (res.ok && rates.USD === 1 && Object.keys(rates).length > 20) {
        value = {
          base: "USD",
          rates: { ...FALLBACK_RATES, ...rates },
          source: "live",
          updated_at: json.time_last_update_utc ? new Date(json.time_last_update_utc).toISOString() : new Date(now).toISOString(),
        }
      }
    } catch {
      // Offline or the rates service is down: keep the built-in rates, and try again sooner.
      cache = { at: now - TTL + 10 * 60 * 1000, value }
      return value
    }
  }
  cache = { at: now, value }
  return value
}
