import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"

/**
 * GET /store/me/orders: a logged-in shopper's orders from every AQUENORA store
 * (matched by the email they paid with), newest first.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: customers } = await query.graph({ entity: "customer", fields: ["id", "email"], filters: { id: req.auth_context.actor_id } })
  const email = customers[0]?.email
  if (!email) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Account not found.")
  const { data } = await query.graph({
    entity: "order",
    fields: [
      "id", "display_id", "created_at", "status", "currency_code", "metadata",
      "items.title", "items.quantity", "items.unit_price", "items.thumbnail",
      "seller.name", "seller.handle",
    ],
    filters: { email: email.toLowerCase() },
  })
  type Raw = {
    id: string; display_id: number; created_at: string | Date; status: string; currency_code: string
    metadata: Record<string, unknown> | null
    items?: ({ title: string; quantity: unknown; unit_price: unknown; thumbnail?: string | null } | null)[] | null
    seller?: { name: string; handle: string } | null
  }
  const orders = (data as unknown as Raw[])
    .map((o) => {
      const items = (o.items ?? []).filter(Boolean).map((i) => ({
        title: i!.title, quantity: Number(i!.quantity) || 0, unit_price: Number(i!.unit_price) || 0, thumbnail: i!.thumbnail ?? null,
      }))
      const ship = o.metadata?.shipping as { name?: string; price?: unknown } | undefined
      return {
        id: o.id,
        display_id: o.display_id,
        created_at: new Date(o.created_at).toISOString(),
        store: o.seller ? { name: o.seller.name, handle: o.seller.handle } : null,
        currency_code: o.currency_code,
        status: o.status === "canceled" ? "canceled" : (o.metadata?.seller_status as string) ?? "new",
        fulfillment: o.metadata?.fulfillment === "pickup" ? "pickup" : "delivery",
        items,
        total: items.reduce((a, i) => a + i.quantity * i.unit_price, 0) + (Number(ship?.price) || 0),
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  res.json({ orders })
}
