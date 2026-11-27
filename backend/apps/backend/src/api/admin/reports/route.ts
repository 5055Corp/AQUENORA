import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/** GET /admin/reports?status=open|all: reported products, grouped by product, most-reported first. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const sellers = req.scope.resolve<SellerModuleService>(SELLER_MODULE)
  const status = String(req.query.status ?? "open")
  const rows = await sellers.listProductReports(status === "all" ? {} : { status: "open" }, { order: { created_at: "DESC" }, take: 500 })
  const groups = new Map<string, { report_id: string; product_id: string; seller_id: string; count: number; reasons: Record<string, number>; notes: string[]; status: string; last_at: Date }>()
  for (const r of rows) {
    const g = groups.get(r.product_id) ?? { report_id: r.id, product_id: r.product_id, seller_id: r.seller_id, count: 0, reasons: {}, notes: [], status: r.status, last_at: r.created_at as Date }
    g.count++
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1
    if (r.note) g.notes.push(r.note)
    groups.set(r.product_id, g)
  }
  const list = [...groups.values()]
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = list.length
    ? await query.graph({ entity: "product", fields: ["id", "title", "thumbnail", "metadata"], filters: { id: list.map((g) => g.product_id) } })
    : { data: [] as unknown[] }
  const shops = list.length ? await sellers.listSellers({ id: [...new Set(list.map((g) => g.seller_id))] }, { select: ["id", "name", "handle", "suspended_at"] }) : []
  const p = new Map((products as { id: string; title: string; thumbnail: string | null; metadata: Record<string, unknown> | null }[]).map((x) => [x.id, x]))
  const s = new Map(shops.map((x) => [x.id, x]))
  res.json({
    reports: list
      .sort((a, b) => b.count - a.count)
      .map((g) => ({
        ...g,
        product: p.get(g.product_id) ? { id: g.product_id, title: p.get(g.product_id)!.title, thumbnail: p.get(g.product_id)!.thumbnail, hidden: !!p.get(g.product_id)!.metadata?.hidden_by_aquenora } : null,
        seller: s.get(g.seller_id) ?? null,
      })),
  })
}
