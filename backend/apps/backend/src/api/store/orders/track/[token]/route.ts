import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { orderIdFromToken } from "../../../../../lib/order-tracking"
import { disputeForOrder, disputeView } from "../../../../../lib/dispute-access"

type Raw = {
  id: string
  display_id: number
  created_at: string | Date
  status: string
  currency_code: string
  metadata: Record<string, unknown> | null
  shipping_address?: { city?: string | null; province?: string | null; country_code?: string | null } | null
  items?: ({ title: string; quantity: unknown; unit_price: unknown; metadata?: Record<string, unknown> | null } | null)[] | null
  seller?: { name: string; handle: string; design?: { social?: { whatsapp?: string } } | null; pickup?: { address?: string; area?: string } | null } | null
}

/**
 * GET /store/orders/track/:token
 * An order's progress for the buyer, from the link in their confirmation email. The token is
 * signed (lib/order-tracking), so only the buyer's link works. Shows no email, phone or street address.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const id = orderIdFromToken(String(req.params.token ?? ""))
  const notFound = () => new MedusaError(MedusaError.Types.NOT_FOUND, "We couldn't find that order. Check the link in your email.")
  if (!id) throw notFound()
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "created_at", "status", "currency_code", "metadata",
      "shipping_address.city", "shipping_address.province", "shipping_address.country_code",
      "items.title", "items.quantity", "items.unit_price", "items.metadata",
      "seller.name", "seller.handle", "seller.design", "seller.pickup",
    ],
    filters: { id },
  })
  const o = data[0] as unknown as Raw | undefined
  if (!o) throw notFound()
  const meta = o.metadata ?? {}
  const pickup = meta.fulfillment === "pickup"
  const items = (o.items ?? []).filter(Boolean).map((i) => ({
    title: i!.title,
    quantity: Number(i!.quantity) || 0,
    unit_price: Number(i!.unit_price) || 0,
    note: typeof i!.metadata?.note === "string" ? i!.metadata.note : null,
    made_to_order_days: Number(i!.metadata?.made_to_order_days) || null,
  }))
  const shipping = meta.shipping as { name?: string; price?: number; days?: string } | undefined
  const days = Math.max(0, ...items.map((i) => i.made_to_order_days ?? 0))
  res.json({
    dispute: disputeView(await disputeForOrder(req.scope, o.id)),
    order: {
      display_id: o.display_id,
      created_at: o.created_at,
      status: o.status === "canceled" ? "canceled" : (meta.seller_status as string) ?? "new",
      fulfillment: pickup ? "pickup" : "delivery",
      currency_code: o.currency_code,
      items,
      total: items.reduce((a, i) => a + i.quantity * i.unit_price, 0) + (Number(shipping?.price) || 0),
      shipping: shipping?.name ? { name: shipping.name, price: Number(shipping.price) || 0, days: shipping.days ?? "" } : null,
      made_to_order_days: days || null,
      // Area only, never the street address.
      place: pickup ? null : [o.shipping_address?.city, o.shipping_address?.province].filter(Boolean).join(", ") || null,
      pickup_address: pickup ? [o.seller?.pickup?.address, o.seller?.pickup?.area].filter(Boolean).join(", ") || null : null,
    },
    store: {
      name: o.seller?.name ?? "",
      handle: o.seller?.handle ?? "",
      whatsapp: o.seller?.design?.social?.whatsapp || null,
    },
  })
}
