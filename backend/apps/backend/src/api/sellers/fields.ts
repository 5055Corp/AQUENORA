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
  "theme",
  "accent",
  "font",
  "announcement",
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
    created_at: p.created_at,
  }
}

export function newestFirst<T extends { created_at: string | Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}
