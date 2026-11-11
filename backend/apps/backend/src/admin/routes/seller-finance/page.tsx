import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChartBar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Period = "7d" | "30d" | "all"

type SellerRow = {
  id: string
  name: string
  handle: string
  email: string
  country_code: string
  currency_code: string
  products: number
  orders: number
  revenue: number
  cost_of_goods: number
  payment_fees: number
  platform_fees: number
  profit: number
  items_missing_cost: number
}

type CurrencyTotal = {
  currency_code: string
  sellers: number
  orders: number
  revenue: number
  profit: number
  platform_fees: number
}

type Response = { period: Period; sellers: SellerRow[]; totals_by_currency: CurrencyTotal[] }

const PERIODS: [Period, string][] = [
  ["7d", "Last 7 days"],
  ["30d", "Last 30 days"],
  ["all", "All time"],
]

/** Money in the seller's own currency (naira, cedis, rand...). */
function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency.toUpperCase()} ${Math.round(amount).toLocaleString()}`
  }
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–")

/**
 * AQUENORA owner page (/app/seller-finance): every seller's sales and profit, and what AQUENORA
 * earned from them. Totals stay per currency; they can't be added together.
 */
const SellerFinancePage = () => {
  const [period, setPeriod] = useState<Period>("30d")
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    let stale = false
    fetch(`/admin/finance/sellers?period=${period}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Could not load (${res.status})`)
        }
        return res.json() as Promise<Response>
      })
      .then((json) => !stale && (setData(json), setError("")))
      .catch((e) => !stale && setError(e instanceof Error ? e.message : "Could not load"))
    return () => {
      stale = true
    }
  }, [period])

  const shown = data?.period === period ? data : null

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Heading level="h1">Sellers: sales and profit</Heading>
            <Text size="small" className="text-ui-fg-subtle mt-1">
              Each seller's sales, their profit after product costs and fees, and AQUENORA's commission. Paystack fees are
              estimated until payments run through AQUENORA.
            </Text>
          </div>
          <div className="flex gap-2" role="group" aria-label="Time period">
            {PERIODS.map(([key, label]) => (
              <Button key={key} size="small" variant={period === key ? "primary" : "secondary"} onClick={() => setPeriod(key)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        {error && <Text className="text-ui-fg-error">{error}</Text>}
        {!shown && !error && <Text className="text-ui-fg-subtle">Loading…</Text>}

        {shown && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {shown.totals_by_currency.length === 0 && <Text className="text-ui-fg-subtle">No sellers yet.</Text>}
            {shown.totals_by_currency.map((t) => (
              <div key={t.currency_code} className="shadow-elevation-card-rest bg-ui-bg-component rounded-lg p-4">
                <Text size="small" weight="plus" className="text-ui-fg-subtle">
                  {t.currency_code.toUpperCase()} · {t.sellers} {t.sellers === 1 ? "seller" : "sellers"} · {t.orders} orders
                </Text>
                <Heading level="h2" className="mt-2">{money(t.revenue, t.currency_code)}</Heading>
                <Text size="small" className="text-ui-fg-subtle">sales</Text>
                <div className="mt-3 flex justify-between gap-2">
                  <div>
                    <Text size="small" weight="plus">{money(t.platform_fees, t.currency_code)}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">AQUENORA earned</Text>
                  </div>
                  <div className="text-right">
                    <Text size="small" weight="plus">{money(t.profit, t.currency_code)}</Text>
                    <Text size="xsmall" className="text-ui-fg-subtle">sellers' profit</Text>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>

      {shown && shown.sellers.length > 0 && (
        <Container className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Seller</Table.HeaderCell>
                  <Table.HeaderCell>Country</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Orders</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Sales</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Product costs</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Paystack fees</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">AQUENORA earned</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Seller profit</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Margin</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {shown.sellers.map((s) => (
                  <Table.Row key={s.id}>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="txt-compact-small-plus">{s.name}</span>
                        <span className="txt-compact-xsmall text-ui-fg-subtle">{s.handle}.aquenora.com · {s.email}</span>
                        {s.items_missing_cost > 0 && (
                          <Badge size="2xsmall" color="orange" className="mt-1 w-fit">
                            {s.items_missing_cost} items without cost price
                          </Badge>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>{s.country_code}</Table.Cell>
                    <Table.Cell className="text-right">{s.orders}</Table.Cell>
                    <Table.Cell className="text-right">{money(s.revenue, s.currency_code)}</Table.Cell>
                    <Table.Cell className="text-right">{money(s.cost_of_goods, s.currency_code)}</Table.Cell>
                    <Table.Cell className="text-right">{money(s.payment_fees, s.currency_code)}</Table.Cell>
                    <Table.Cell className="text-right">{money(s.platform_fees, s.currency_code)}</Table.Cell>
                    <Table.Cell className={`text-right ${s.profit < 0 ? "text-ui-fg-error" : ""}`}>{money(s.profit, s.currency_code)}</Table.Cell>
                    <Table.Cell className="text-right">{pct(s.profit, s.revenue)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        </Container>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Seller finances",
  icon: ChartBar,
})

export default SellerFinancePage
