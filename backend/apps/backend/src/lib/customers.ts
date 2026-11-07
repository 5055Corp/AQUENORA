// A seller's past buyers, worked out from their orders, and the campaign audiences.

export type Audience = "all" | "repeat" | "lapsed"

/** Buyers with no order for this many days are "lapsed". */
export const LAPSED_DAYS = 60

type RawOrder = {
  status: string
  email: string | null
  created_at: string | Date
  shipping_address?: { first_name?: string | null; last_name?: string | null } | null
  items?: ({ quantity: unknown; unit_price: unknown } | null)[] | null
}

export type Contact = { email: string; subscribed: boolean }

export type Customer = {
  email: string
  name: string | null
  orders: number
  total_spent: number
  first_order_at: string
  last_order_at: string
  /** Agreed at checkout to get emails from this shop, and hasn't unsubscribed. */
  subscribed: boolean
}

export function pastCustomers(orders: unknown[], contacts: Contact[]): Customer[] {
  const subscribed = new Map(contacts.map((c) => [c.email.toLowerCase(), c.subscribed]))
  const byEmail = new Map<string, Customer>()
  for (const raw of orders) {
    const o = raw as RawOrder
    if (!o || o.status === "canceled" || !o.email) {
      continue
    }
    const email = o.email.toLowerCase()
    const at = new Date(o.created_at).toISOString()
    const total = (o.items ?? []).reduce((a, i) => a + (Number(i?.quantity) || 0) * (Number(i?.unit_price) || 0), 0)
    const name = [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(" ") || null
    const c = byEmail.get(email)
    if (!c) {
      byEmail.set(email, { email, name, orders: 1, total_spent: total, first_order_at: at, last_order_at: at, subscribed: subscribed.get(email) ?? false })
      continue
    }
    c.orders += 1
    c.total_spent += total
    if (at < c.first_order_at) {
      c.first_order_at = at
    }
    if (at >= c.last_order_at) {
      c.last_order_at = at
      c.name = name ?? c.name
    }
  }
  return [...byEmail.values()].sort((a, b) => b.last_order_at.localeCompare(a.last_order_at))
}

/** Subscribed customers in an audience. Unsubscribed buyers are never included. */
export function inAudience(customers: Customer[], audience: Audience, now = new Date()): Customer[] {
  const cutoff = new Date(now.getTime() - LAPSED_DAYS * 86400000).toISOString()
  return customers.filter((c) => {
    if (!c.subscribed) {
      return false
    }
    if (audience === "repeat") {
      return c.orders >= 2
    }
    if (audience === "lapsed") {
      return c.last_order_at < cutoff
    }
    return true
  })
}

export function audienceCounts(customers: Customer[], now = new Date()) {
  return {
    all: inAudience(customers, "all", now).length,
    repeat: inAudience(customers, "repeat", now).length,
    lapsed: inAudience(customers, "lapsed", now).length,
  }
}
