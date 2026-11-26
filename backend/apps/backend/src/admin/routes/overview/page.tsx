import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Money = Record<string, number>
type Overview = {
  period: string
  sales: Money
  commission: Money
  orders: number
  previous: { sales: Money; commission: Money; orders: number } | null
  sellers: { total: number; new: number; new_previous: number | null; pro: number; trial: number; suspended: number }
  top_stores: { name: string; handle: string; currency: string; sales: number; orders: number }[]
  needs_you: { verifications: number; disputes: number; escalated: number; reported_products: number }
}

const PERIODS = [["month", "This month"], ["last", "Last month"], ["all", "All time"]] as const
const SYMBOL: Record<string, string> = { ngn: "₦", ghs: "GH₵", zar: "R", kes: "KSh ", usd: "$", gbp: "£" }
const fmt = (m: Money) => Object.entries(m).length ? Object.entries(m).map(([c, v]) => `${SYMBOL[c] ?? c.toUpperCase() + " "}${Math.round(v).toLocaleString("en")}`).join(" · ") : "—"
const total = (m: Money) => Object.values(m).reduce((a, b) => a + b, 0)
const change = (now: number, before: number | null | undefined) => {
  if (before == null) return null
  if (!before) return now ? "New" : null
  const pct = Math.round(((now - before) / before) * 100)
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct)}%`
}

function Tile({ label, value, delta }: { label: string; value: string; delta?: string | null }) {
  return (
    <Container className="flex flex-col gap-1 px-5 py-4">
      <Text size="small" className="text-ui-fg-subtle">{label}</Text>
      <Text className="text-xl font-semibold">{value}</Text>
      {delta && <Text size="xsmall" className={delta.startsWith("▼") ? "text-ui-fg-error" : "text-ui-tag-green-text"}>{delta}</Text>}
    </Container>
  )
}

/** AQUENORA at a glance: sales, commission, sellers, top stores and what needs attention. */
const OverviewPage = () => {
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("month")
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState("")
  useEffect(() => {
    setData(null)
    fetch(`/admin/overview?period=${period}`, { credentials: "include" })
      .then(async (r) => (r.ok ? setData(await r.json()) : setError(`Could not load (${r.status})`)))
      .catch((e: Error) => setError(e.message))
  }, [period])
  const prev = data?.previous

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <Heading>AQUENORA overview</Heading>
          <Text size="small" className="text-ui-fg-subtle">Sales through every store, your commission, sellers and what needs you.</Text>
        </div>
        <div className="flex gap-2">
          {PERIODS.map(([k, l]) => <Button key={k} size="small" variant={period === k ? "primary" : "secondary"} onClick={() => setPeriod(k)}>{l}</Button>)}
        </div>
      </Container>
      {error && <Container className="px-6 py-4"><Text className="text-ui-fg-error">{error}</Text></Container>}
      {!data && !error && <Container className="px-6 py-4"><Text>Loading…</Text></Container>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <Tile label="Sales through AQUENORA" value={fmt(data.sales)} delta={prev ? change(total(data.sales), total(prev.sales)) : null} />
            <Tile label="Your commission" value={fmt(data.commission)} delta={prev ? change(total(data.commission), total(prev.commission)) : null} />
            <Tile label="Orders" value={String(data.orders)} delta={prev ? change(data.orders, prev.orders) : null} />
            <Tile label="New sellers" value={String(data.sellers.new)} delta={change(data.sellers.new, data.sellers.new_previous)} />
            <Tile label="Pro sellers" value={`${data.sellers.pro}${data.sellers.trial ? ` (+${data.sellers.trial} on trial)` : ""}`} />
            <Tile label="All sellers" value={`${data.sellers.total}${data.sellers.suspended ? ` · ${data.sellers.suspended} paused` : ""}`} />
          </div>
          <Container className="flex flex-col gap-3 px-6 py-4">
            <Heading level="h2">Needs you</Heading>
            <div className="flex flex-wrap gap-2">
              <a href="/app/seller-verification"><Badge color={data.needs_you.verifications ? "orange" : "grey"}>{data.needs_you.verifications} sellers waiting for verification</Badge></a>
              <a href="/app/moderation"><Badge color={data.needs_you.escalated ? "red" : data.needs_you.disputes ? "orange" : "grey"}>{data.needs_you.disputes} open problems ({data.needs_you.escalated} asking for you)</Badge></a>
              <a href="/app/moderation"><Badge color={data.needs_you.reported_products ? "red" : "grey"}>{data.needs_you.reported_products} reported products</Badge></a>
            </div>
          </Container>
          <Container className="flex flex-col gap-2 px-6 py-4">
            <Heading level="h2">Top stores</Heading>
            {data.top_stores.length === 0 && <Text size="small" className="text-ui-fg-subtle">No sales in this period yet.</Text>}
            {data.top_stores.map((s, i) => (
              <div key={s.handle} className="flex justify-between border-b border-ui-border-base py-2 last:border-0">
                <Text size="small">{i + 1}. {s.name} <span className="text-ui-fg-subtle">· {s.orders} orders</span></Text>
                <Text size="small" className="font-medium">{fmt({ [s.currency]: s.sales })}</Text>
              </div>
            ))}
          </Container>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({ label: "AQUENORA overview", icon: ChartBar })
export default OverviewPage
