// Revenue, costs, fees and profit for sellers' orders. Used by the seller's Money page
// (/sellers/me/finance) and the owner's page (/admin/finance/sellers).
//
// Fees are ESTIMATES from Paystack's published rates until Paystack payments are connected and
// the real fee of each payment is recorded on the order (metadata.payment_fee); then that is used.

type Country = "NG" | "GH" | "ZA" | "CI" | "SN" | "DI"

/** AQENORA's commission on each sale, in percent (AQENORA_COMMISSION_PERCENT, default 2). */
export function platformCommissionRate(): number {
  const pct = Number(process.env.AQENORA_COMMISSION_PERCENT ?? 2)
  return Number.isFinite(pct) && pct >= 0 && pct <= 50 ? pct / 100 : 0.02
}

/**
 * Paystack's fee for one payment, in the seller's currency (whole units).
 * Rates from Paystack's published pricing (checked Oct 2026); re-check before launch.
 * - Nigeria: 1.5% + NGN 100 (the NGN 100 is waived under NGN 2,500), capped at NGN 2,000.
 *   International cards: 3.9% + NGN 100.
 * - Ghana: 1.95%.
 * - South Africa: 2.9% + R1 (international 3.1% + R1), plus 15% VAT on the fee.
 * - Cote d'Ivoire, Senegal and sellers abroad: no published flat rate we can rely on yet, so a
 *   cautious 3.9% is assumed.
 */
export function estimatePaymentFee(country: Country, amount: number, international = false): number {
  if (amount <= 0) {
    return 0
  }
  switch (country) {
    case "NG": {
      if (international) {
        return round(amount * 0.039 + 100)
      }
      const fee = amount * 0.015 + (amount < 2500 ? 0 : 100)
      return round(Math.min(fee, 2000))
    }
    case "GH":
      return round(amount * 0.0195)
    case "ZA":
      return round((amount * (international ? 0.031 : 0.029) + 1) * 1.15)
    default:
      return round(amount * 0.039)
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export type FinanceItem = {
  product_id: string | null
  title: string
  quantity: number
  unit_price: number
  /** Cost price captured when the order was placed, if the product had one. */
  cost_price?: number | null
}

export type FinanceOrder = {
  id: string
  created_at: string | Date
  status: string
  international: boolean
  /** Real Paystack fee, once payments record it. */
  payment_fee?: number | null
  items: FinanceItem[]
}

export type Period = "7d" | "30d" | "all"

export function periodStart(period: Period, now = new Date()): Date | null {
  if (period === "all") {
    return null
  }
  const days = period === "7d" ? 7 : 30
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return start
}

/** Calendar days (UTC) from start to today, so the chart shows days with no sales too. */
function dayKeys(start: Date, now: Date): string[] {
  const keys: string[] = []
  const d = new Date(start)
  while (d <= now) {
    keys.push(d.toISOString().slice(0, 10))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return keys
}

/**
 * Totals for one seller's orders in a period. Cancelled orders don't count.
 * `currentCosts` fills in a cost price for items sold before the seller entered one.
 */
export function summarizeSeller(
  orders: FinanceOrder[],
  country: Country,
  period: Period,
  currentCosts: Map<string, number> = new Map(),
  now = new Date()
) {
  const start = periodStart(period, now)
  const commission = platformCommissionRate()
  const counted = orders.filter(
    (o) => o.status !== "canceled" && (!start || new Date(o.created_at) >= start)
  )

  const totals = {
    orders: counted.length,
    items_sold: 0,
    revenue: 0,
    cost_of_goods: 0,
    payment_fees: 0,
    platform_fees: 0,
    profit: 0,
    /** Units sold whose product has no cost price yet; their cost is counted as 0. */
    items_missing_cost: 0,
  }
  const byProduct = new Map<string, { product_id: string | null; title: string; quantity: number; revenue: number; cost: number; profit: number }>()
  const byBucket = new Map<string, { revenue: number; profit: number }>()

  for (const order of counted) {
    let orderRevenue = 0
    let orderCost = 0
    const lines: { key: string; product_id: string | null; title: string; quantity: number; revenue: number; cost: number }[] = []

    for (const item of order.items) {
      const qty = Number(item.quantity) || 0
      const revenue = qty * (Number(item.unit_price) || 0)
      const unitCost = item.cost_price ?? (item.product_id ? currentCosts.get(item.product_id) : undefined)
      if (unitCost == null) {
        totals.items_missing_cost += qty
      }
      const cost = qty * (unitCost ?? 0)
      orderRevenue += revenue
      orderCost += cost
      totals.items_sold += qty
      lines.push({ key: item.product_id ?? item.title, product_id: item.product_id, title: item.title, quantity: qty, revenue, cost })
    }

    const paymentFee = order.payment_fee ?? estimatePaymentFee(country, orderRevenue, order.international)
    const platformFee = round(orderRevenue * commission)
    const orderProfit = orderRevenue - orderCost - paymentFee - platformFee

    totals.revenue += orderRevenue
    totals.cost_of_goods += orderCost
    totals.payment_fees += paymentFee
    totals.platform_fees += platformFee
    totals.profit += orderProfit

    // Fees are per order; share them across its products by revenue for the product table.
    for (const line of lines) {
      const share = orderRevenue > 0 ? line.revenue / orderRevenue : 0
      const p = byProduct.get(line.key) ?? { product_id: line.product_id, title: line.title, quantity: 0, revenue: 0, cost: 0, profit: 0 }
      p.quantity += line.quantity
      p.revenue += line.revenue
      p.cost += line.cost
      p.profit += line.revenue - line.cost - (paymentFee + platformFee) * share
      byProduct.set(line.key, p)
    }

    const bucket = new Date(order.created_at).toISOString().slice(0, period === "all" ? 7 : 10)
    const b = byBucket.get(bucket) ?? { revenue: 0, profit: 0 }
    b.revenue += orderRevenue
    b.profit += orderProfit
    byBucket.set(bucket, b)
  }

  // 7 and 30 days: one point per day (zeros included). All time: one point per month with sales.
  const keys = start ? dayKeys(start, now) : [...byBucket.keys()].sort()
  const series = keys.map((k) => ({
    date: k,
    revenue: round(byBucket.get(k)?.revenue ?? 0),
    profit: round(byBucket.get(k)?.profit ?? 0),
  }))

  return {
    period,
    granularity: start ? ("day" as const) : ("month" as const),
    commission_rate: commission,
    fee_basis: counted.some((o) => o.payment_fee == null) ? ("estimate" as const) : ("actual" as const),
    totals: {
      ...totals,
      revenue: round(totals.revenue),
      cost_of_goods: round(totals.cost_of_goods),
      payment_fees: round(totals.payment_fees),
      platform_fees: round(totals.platform_fees),
      profit: round(totals.profit),
    },
    series,
    by_product: [...byProduct.values()]
      .map((p) => ({ ...p, revenue: round(p.revenue), cost: round(p.cost), profit: round(p.profit) }))
      .sort((a, b) => b.revenue - a.revenue),
  }
}

// ---- reading orders from query.graph results ----

type RawOrder = {
  id: string
  created_at: string | Date
  status: string
  metadata?: Record<string, unknown> | null
  items?: ({ product_id?: string | null; title: string; quantity: unknown; unit_price: unknown; metadata?: Record<string, unknown> | null } | null)[] | null
}

const num = (v: unknown): number | null => {
  const n = typeof v === "object" && v !== null && "numeric" in v ? Number((v as { numeric: unknown }).numeric) : Number(v)
  return v == null || v === "" || !Number.isFinite(n) ? null : n
}

/** Converts an order from query.graph (ORDER_FIELDS) into the shape the summaries use. */
export function toFinanceOrder(raw: unknown): FinanceOrder {
  const o = raw as RawOrder
  return {
    id: o.id,
    created_at: o.created_at,
    status: o.status,
    international: o.metadata?.international === true,
    payment_fee: num(o.metadata?.payment_fee),
    items: (o.items ?? []).filter(Boolean).map((i) => ({
      product_id: i!.product_id ?? null,
      title: i!.title,
      quantity: num(i!.quantity) ?? 0,
      unit_price: num(i!.unit_price) ?? 0,
      cost_price: num(i!.metadata?.cost_price),
    })),
  }
}

export const ORDER_FIELDS = [
  "orders.id",
  "orders.display_id",
  "orders.created_at",
  "orders.status",
  "orders.email",
  "orders.currency_code",
  "orders.metadata",
  "orders.items.id",
  "orders.items.product_id",
  "orders.items.title",
  "orders.items.quantity",
  "orders.items.unit_price",
  "orders.items.metadata",
]
