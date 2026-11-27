import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { paymentsBlocker } from "./checkout"

/**
 * AQUENORA's shopping side: search across stores, and the shop home page.
 *
 * Quality rules: a store appears only if the seller left "Show my store in AQUENORA search" on
 * and can take payments; a product appears only if it's published, in stock and has a photo.
 * (Each store's own page at <handle>.aquenora.com still shows everything it sells.)
 */

type RawProduct = {
  id: string
  title: string
  description?: string | null
  status: string
  thumbnail?: string | null
  images?: ({ url: string; rank?: number | null } | null)[] | null
  metadata?: Record<string, unknown> | null
  created_at: string | Date
  variants?: ({ prices?: ({ amount: number | string; currency_code: string } | null)[] | null } | null)[] | null
}

type RawSeller = {
  id: string
  name: string
  handle: string
  category: string
  country_code: string
  currency_code: string
  sells_abroad: boolean
  theme: string
  accent: string
  font: string
  design: Record<string, unknown> | null
  paystack_subaccount_code: string | null
  verification_status?: string | null
  suspended_at?: string | Date | null
  marketplace_listed?: boolean | null
  created_at: string | Date
  products?: (RawProduct | null)[] | null
}

export type MarketProduct = {
  id: string
  title: string
  description: string | null
  price: number
  currency_code: string
  image: string
  photo_count: number
  created_at: string
}

export type MarketStore = {
  handle: string
  name: string
  category: string
  country_code: string
  currency_code: string
  sells_abroad: boolean
  theme: string
  accent: string
  font: string
  /** The store's design (logo, banner, colours); null = the legacy theme/accent/font. */
  design: Record<string, unknown> | null
  product_count: number
}

type Listed = { store: MarketStore; products: MarketProduct[] }

const SELLER_FIELDS = [
  "id", "name", "handle", "category", "country_code", "currency_code", "sells_abroad",
  "theme", "accent", "font", "design", "paystack_subaccount_code", "verification_status", "suspended_at", "marketplace_listed", "created_at",
  "products.id", "products.title", "products.description", "products.status", "products.thumbnail",
  "products.images.url", "products.images.rank", "products.metadata", "products.created_at",
  "products.variants.prices.amount", "products.variants.prices.currency_code",
]

import { fromPrice, madeToOrderDays, readOptions } from "./product-options"

function toMarketProduct(p: RawProduct, currency: string): MarketProduct | null {
  if (p.status !== "published") return null
  if (p.metadata?.hidden_by_aquenora) return null
  if (!madeToOrderDays(p.metadata) && Number(p.metadata?.stock ?? 0) <= 0) return null
  const images = (p.images ?? []).filter((i): i is { url: string; rank?: number | null } => !!i?.url)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
  const image = images[0]?.url ?? p.thumbnail ?? null
  if (!image) return null
  const price = (p.variants ?? []).flatMap((v) => v?.prices ?? []).find((pr) => pr?.currency_code === currency)
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    // With options, the lowest price ("from").
    price: fromPrice(readOptions(p.metadata), price ? Number(price.amount) : 0),
    currency_code: currency,
    image,
    photo_count: Math.max(images.length, 1),
    created_at: new Date(p.created_at).toISOString(),
  }
}

/** Every store shown on AQUENORA, with its products that pass the quality rules. */
export async function listedStores(container: MedusaContainer): Promise<Listed[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: SELLER_FIELDS })
  const out: Listed[] = []
  for (const raw of data as unknown as RawSeller[]) {
    if (raw.marketplace_listed === false) continue
    if (paymentsBlocker(raw)) continue
    const products = (raw.products ?? [])
      .flatMap((p) => (p ? [toMarketProduct(p, raw.currency_code)] : []))
      .filter((p): p is MarketProduct => !!p)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
    if (!products.length) continue
    out.push({
      store: {
        handle: raw.handle,
        name: raw.name,
        category: raw.category,
        country_code: raw.country_code,
        currency_code: raw.currency_code,
        sells_abroad: raw.sells_abroad,
        theme: raw.theme,
        accent: raw.accent,
        font: raw.font,
        design: raw.design ?? null,
        product_count: products.length,
      },
      products,
    })
  }
  return out
}

/** Lower-case words of a search ("Adire  KIMONO!" -> ["adire", "kimono"]). */
export function searchWords(q: string): string[] {
  return q.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 0).slice(0, 8)
}

const plain = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")

/** How well a product matches: 0 = not at all. Every word must appear somewhere. */
function score(words: string[], p: MarketProduct, store: MarketStore): number {
  const title = plain(p.title)
  const rest = plain(`${p.description ?? ""} ${store.category} ${store.name}`)
  let total = 0
  for (const w of words) {
    if (title.includes(w)) total += title.split(/[^a-z0-9]+/).includes(w) ? 3 : 2
    else if (rest.includes(w)) total += 1
    else return 0
  }
  return total
}

export const SEARCH_MATCHES_PER_STORE = 6

/** Search results grouped by store: stores with the most (and best) matches first. */
export function search(listed: Listed[], q: string, category?: string) {
  const words = searchWords(q)
  const groups = listed
    .filter((l) => !category || l.store.category === category)
    .map((l) => {
      const scored = l.products
        .map((p) => ({ p, s: words.length ? score(words, p, l.store) : 1 }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || b.p.created_at.localeCompare(a.p.created_at))
      return { store: l.store, matches: scored.map((x) => x.p), best: scored.reduce((m, x) => Math.max(m, x.s), 0) }
    })
    .filter((g) => g.matches.length > 0)
    .sort((a, b) => b.best - a.best || b.matches.length - a.matches.length)
  return {
    query: q,
    total_products: groups.reduce((n, g) => n + g.matches.length, 0),
    stores: groups.map((g) => ({
      ...g.store,
      match_count: g.matches.length,
      matches: g.matches.slice(0, SEARCH_MATCHES_PER_STORE),
    })),
  }
}

/** The shop home page: categories, featured stores and newest products. */
export function home(listed: Listed[]) {
  const counts = new Map<string, number>()
  for (const l of listed) counts.set(l.store.category, (counts.get(l.store.category) ?? 0) + 1)
  const hasLook = (s: MarketStore) => !!(s.design && (s.design.logo || (s.design.banner as { image?: unknown } | undefined)?.image))
  const featured = [...listed]
    .sort((a, b) => Number(hasLook(b.store)) - Number(hasLook(a.store)) || b.products.length - a.products.length)
    .slice(0, 8)
    .map((l) => l.store)
  const trending = listed
    .flatMap((l) => l.products.slice(0, 3).map((p) => ({ ...p, store: { handle: l.store.handle, name: l.store.name } })))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 12)
  return {
    categories: [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    featured,
    trending,
  }
}
