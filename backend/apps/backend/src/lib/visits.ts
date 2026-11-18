// Store visit counts (see modules/seller/models/store-visit.ts).

import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, generateEntityId } from "@medusajs/framework/utils"

export const VISIT_SOURCES = ["whatsapp", "instagram", "facebook", "tiktok", "google", "aquenora", "direct", "other"] as const
export type VisitSource = (typeof VISIT_SOURCES)[number]

export const dayOf = (d: Date) => d.toISOString().slice(0, 10)

/** Adds one visit to today's count for this store and source. */
export async function recordVisit(container: MedusaContainer, sellerId: string, source: VisitSource) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  await pg.raw(
    `insert into "store_visit" ("id", "seller_id", "day", "source", "count") values (?, ?, ?, ?, 1)
     on conflict ("seller_id", "day", "source") do update set "count" = "store_visit"."count" + 1, "updated_at" = now()`,
    [generateEntityId("", "svis"), sellerId, dayOf(new Date()), source]
  )
}

/** This week and last week, day by day (oldest first), and where this week's visits came from. */
export function summarizeVisits(rows: { day: string; source: string; count: number }[], now = new Date()) {
  const days = Array.from({ length: 14 }, (_, i) => dayOf(new Date(now.getTime() - (13 - i) * 86400000)))
  const byDay = new Map(days.map((d) => [d, 0]))
  const sources: Record<string, number> = {}
  const thisWeek = new Set(days.slice(7))
  for (const r of rows) {
    if (!byDay.has(r.day)) continue
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + Number(r.count))
    if (thisWeek.has(r.day)) sources[r.source] = (sources[r.source] ?? 0) + Number(r.count)
  }
  const counts = days.map((d) => byDay.get(d) ?? 0)
  return {
    days: days.slice(7),
    by_day: counts.slice(7),
    week: counts.slice(7).reduce((a, b) => a + b, 0),
    previous_week: counts.slice(0, 7).reduce((a, b) => a + b, 0),
    sources,
  }
}
