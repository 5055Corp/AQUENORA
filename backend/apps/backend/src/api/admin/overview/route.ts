import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

type Row = {
  id: string
  created_at: string | Date
  status: string
  currency_code: string
  metadata: Record<string, unknown> | null
  items?: ({ unit_price: unknown; quantity: unknown } | null)[] | null
  seller?: { id: string; name: string; handle: string } | null
}

/** Start and end of "this month", "last month" or all time (UTC). */
function range(period: string, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  if (period === "last") return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)), to: start }
  if (period === "all") return { from: new Date(0), to: new Date(8.64e15) }
  return { from: start, to: new Date(8.64e15) }
}

/**
 * GET /admin/overview?period=month|last|all
 * AQUENORA at a glance: sales through AQUENORA and commission (by currency), orders, new sellers,
 * Pro sellers, top stores, and what needs the owner's attention.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const period = ["month", "last", "all"].includes(String(req.query.period)) ? String(req.query.period) : "month"
  const { from, to } = range(period)
  const prev = period === "month" ? range("last") : null
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)

  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "created_at", "status", "currency_code", "metadata", "items.unit_price", "items.quantity", "seller.id", "seller.name", "seller.handle"],
    filters: { created_at: { $gte: prev ? prev.from : from } } as never,
  })
  const orders = (data as unknown as Row[]).filter((o) => o.status !== "canceled")
  const inRange = (o: Row, f: Date, t: Date) => new Date(o.created_at) >= f && new Date(o.created_at) < t
  const sumUp = (list: Row[]) => {
    const sales: Record<string, number> = {}
    const commission: Record<string, number> = {}
    for (const o of list) {
      const items = (o.items ?? []).filter(Boolean).reduce((a, i) => a + Number(i!.unit_price) * Number(i!.quantity), 0)
      sales[o.currency_code] = (sales[o.currency_code] ?? 0) + items
      commission[o.currency_code] = (commission[o.currency_code] ?? 0) + (Number(o.metadata?.platform_fee) || 0)
    }
    return { sales, commission, orders: list.length }
  }
  const now = sumUp(orders.filter((o) => inRange(o, from, to)))
  const before = prev ? sumUp(orders.filter((o) => inRange(o, prev.from, prev.to))) : null

  const top = new Map<string, { name: string; handle: string; currency: string; sales: number; orders: number }>()
  for (const o of orders.filter((x) => inRange(x, from, to) && x.seller)) {
    const t = top.get(o.seller!.id) ?? { name: o.seller!.name, handle: o.seller!.handle, currency: o.currency_code, sales: 0, orders: 0 }
    t.sales += (o.items ?? []).filter(Boolean).reduce((a, i) => a + Number(i!.unit_price) * Number(i!.quantity), 0)
    t.orders++
    top.set(o.seller!.id, t)
  }

  const all = await sellers.listSellers({}, { select: ["id", "created_at", "pro_paid_until", "trial_ends_at", "verification_status", "suspended_at"], take: 100000 })
  const t0 = Date.now()
  const newSellers = (f: Date, t: Date) => all.filter((s) => new Date(s.created_at as Date) >= f && new Date(s.created_at as Date) < t).length
  const [openDisputes, escalated, openReports] = await Promise.all([
    sellers.listDisputes({ status: ["open", "replied", "refunded", "escalated"] } as never, { select: ["id"], take: 1000 }),
    sellers.listDisputes({ status: "escalated" }, { select: ["id"], take: 1000 }),
    sellers.listProductReports({ status: "open" }, { select: ["product_id"], take: 1000 }),
  ])

  res.json({
    period,
    sales: now.sales,
    commission: now.commission,
    orders: now.orders,
    previous: before,
    sellers: {
      total: all.length,
      new: newSellers(from, to),
      new_previous: prev ? newSellers(prev.from, prev.to) : null,
      pro: all.filter((s) => s.pro_paid_until && new Date(s.pro_paid_until as Date).getTime() > t0).length,
      trial: all.filter((s) => s.trial_ends_at && new Date(s.trial_ends_at as Date).getTime() > t0 && !(s.pro_paid_until && new Date(s.pro_paid_until as Date).getTime() > t0)).length,
      suspended: all.filter((s) => s.suspended_at).length,
    },
    top_stores: [...top.values()].sort((a, b) => b.sales - a.sales).slice(0, 5),
    needs_you: {
      verifications: all.filter((s) => s.verification_status === "pending").length,
      disputes: openDisputes.length,
      escalated: escalated.length,
      reported_products: new Set(openReports.map((r) => r.product_id)).size,
    },
  })
}
