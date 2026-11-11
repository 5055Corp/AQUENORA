/** Seller fields returned by the API (everything the seller app needs; no auth data). */
export const SELLER_FIELDS = [
  "id",
  "email",
  "name",
  "handle",
  "category",
  "country_code",
  "currency_code",
  "sells_abroad",
  "paystack_subaccount_code",
  "payout",
  "theme",
  "accent",
  "font",
  "announcement",
  "design",
  "pickup",
  "shipping",
  "onboarding_completed",
  "created_at",
]

export const PRODUCT_FIELDS = [
  "products.id",
  "products.title",
  "products.handle",
  "products.description",
  "products.status",
  "products.thumbnail",
  "products.metadata",
  "products.created_at",
  "products.variants.id",
  "products.variants.prices.amount",
  "products.variants.prices.currency_code",
]

/** Order fields for the seller's order list (adds the buyer's name, phone and delivery address). */
export const SELLER_ORDER_ADDRESS_FIELDS = [
  "orders.shipping_address.first_name",
  "orders.shipping_address.last_name",
  "orders.shipping_address.phone",
  "orders.shipping_address.address_1",
  "orders.shipping_address.city",
  "orders.shipping_address.province",
  "orders.shipping_address.postal_code",
  "orders.shipping_address.country_code",
]

/** Turns an order from query.graph (ORDER_FIELDS) into what the seller app shows. */
export function toSellerOrder(raw: unknown) {
  const o = raw as {
    id: string
    display_id: number
    created_at: string | Date
    status: string
    email: string | null
    currency_code: string
    metadata: Record<string, unknown> | null
    shipping_address?: {
      first_name?: string | null
      last_name?: string | null
      phone?: string | null
      address_1?: string | null
      city?: string | null
      province?: string | null
      postal_code?: string | null
      country_code?: string | null
    } | null
    items?: ({ title: string; quantity: unknown; unit_price: unknown } | null)[] | null
  }
  const items = (o.items ?? []).filter(Boolean).map((i) => ({
    title: i!.title,
    quantity: Number(i!.quantity) || 0,
    unit_price: Number(i!.unit_price) || 0,
  }))
  const name = [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ")
  return {
    id: o.id,
    display_id: o.display_id,
    created_at: o.created_at,
    customer_name: name || null,
    email: o.email,
    currency_code: o.currency_code,
    // Delivery: "new" (paid, ready to pack) -> "shipped" -> "delivered".
    // Pickup: "new" -> "ready" (ready for pickup) -> "collected". Cancelled orders show as such.
    status: o.status === "canceled" ? "canceled" : (o.metadata?.seller_status as string) ?? "new",
    international: o.metadata?.international === true,
    fulfillment: o.metadata?.fulfillment === "pickup" ? "pickup" : "delivery",
    items,
    // Items only; shipping is shown separately.
    total: items.reduce((a, i) => a + i.quantity * i.unit_price, 0),
    shipping: shippingOf(o.metadata),
    phone: o.shipping_address?.phone ?? null,
    address: o.shipping_address?.address_1
      ? {
          address: o.shipping_address.address_1,
          city: o.shipping_address.city ?? "",
          region: o.shipping_address.province ?? "",
          postal_code: o.shipping_address.postal_code ?? "",
          country: (o.shipping_address.country_code ?? "").toUpperCase(),
        }
      : null,
    display_currency: typeof o.metadata?.display_currency === "string" ? o.metadata.display_currency : null,
  }
}

function shippingOf(meta: Record<string, unknown> | null) {
  const s = meta?.shipping as { carrier?: unknown; name?: unknown; price?: unknown; days?: unknown } | undefined
  if (!s || typeof s !== "object" || typeof s.name !== "string") {
    return null
  }
  return { carrier: String(s.carrier ?? "other"), name: s.name, price: Number(s.price) || 0, days: typeof s.days === "string" ? s.days : "" }
}

type RawProduct = {
  id: string
  title: string
  handle: string
  description?: string | null
  status: string
  thumbnail?: string | null
  metadata?: Record<string, unknown> | null
  created_at: string | Date
  variants?: { prices?: { amount: number | string; currency_code: string }[] }[]
}

/**
 * Flattens a Medusa product (as returned by query.graph with PRODUCT_FIELDS) into the simple
 * shape the seller app and storefront use. Typed loosely because query.graph's generated types
 * differ by entry point (seller.products vs product).
 */
export function toSellerProduct(raw: unknown) {
  const p = raw as RawProduct
  const price = p.variants?.[0]?.prices?.[0]
  const stock = Number(p.metadata?.stock ?? 0)
  const cost = p.metadata?.cost_price
  const costPrice = cost == null || cost === "" ? null : Number(cost)
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description ?? null,
    status: p.status,
    thumbnail: p.thumbnail ?? null,
    price: price ? Number(price.amount) : 0,
    currency_code: price?.currency_code ?? null,
    stock: Number.isFinite(stock) ? stock : 0,
    cost_price: costPrice != null && Number.isFinite(costPrice) ? costPrice : null,
    created_at: p.created_at,
  }
}

export function newestFirst<T extends { created_at: string | Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}
