// Sample history for the browser-only demo (GitHub Pages / seller interviews): six weeks of sales
// by repeat and one-off buyers, built from the demo store's own products. Always the same.

import type { Audience, Customer } from './api';
import type { Product } from './data';
import type { DemoSale } from './finance';

const BUYERS: { name: string; email: string; subscribed: boolean; intl?: boolean }[] = [
  { name: 'Adaeze Okafor', email: 'adaeze@example.com', subscribed: true },
  { name: 'Kwame Mensah', email: 'kwame@example.com', subscribed: true, intl: true },
  { name: 'Ifeoma Bello', email: 'ifeoma@example.com', subscribed: false },
  { name: 'Amara Diallo', email: 'amara@example.com', subscribed: true, intl: true },
  { name: 'Tunde Adeyemi', email: 'tunde@example.com', subscribed: true },
  { name: 'Zainab Musa', email: 'zainab@example.com', subscribed: false },
  { name: 'Chioma Eze', email: 'chioma@example.com', subscribed: true },
  { name: 'Femi Johnson', email: 'femi@example.com', subscribed: true },
  { name: 'Ngozi Uche', email: 'ngozi@example.com', subscribed: true },
];

// [days ago, buyer index, product index, quantity]
const SALES: [number, number, number, number][] = [
  [0, 0, 0, 1], [0, 1, 1, 1], [1, 2, 2, 2], [2, 3, 0, 1], [3, 4, 3, 1], [4, 0, 1, 1],
  [6, 6, 0, 1], [8, 7, 3, 2], [9, 4, 1, 1], [12, 1, 0, 1], [15, 5, 1, 1], [18, 6, 3, 1],
  [21, 0, 0, 2], [26, 7, 1, 1], [33, 2, 0, 1], [38, 3, 3, 1], [41, 5, 0, 1], [44, 7, 1, 1],
  [70, 8, 0, 1], [75, 8, 3, 1], [90, 5, 1, 1],
];

/** Demo products get a cost price of about 55% of the price, except ones the seller added themselves. */
export function demoCost(p: Product, index: number): number | null {
  if (p.cost !== undefined) return p.cost;
  return index === 0 ? null : Math.round(p.price * 0.55);
}

export function demoSales(products: Product[], now = new Date()): (DemoSale & { buyer: (typeof BUYERS)[number] })[] {
  if (!products.length) return [];
  return SALES.map(([daysAgo, b, pi, qty]) => {
    const product = products[pi % products.length];
    const index = pi % products.length;
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(10 + ((b * 3 + pi) % 9), 15, 0, 0);
    const buyer = BUYERS[b];
    return {
      date,
      international: !!buyer.intl,
      buyer,
      items: [{ title: product.name, quantity: qty, unit_price: product.price, cost_price: demoCost(product, index) }],
    };
  });
}

export function demoCustomers(products: Product[], now = new Date()): Customer[] {
  const byEmail = new Map<string, Customer>();
  for (const s of demoSales(products, now)) {
    const total = s.items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
    const at = s.date.toISOString();
    const c = byEmail.get(s.buyer.email);
    if (!c) {
      byEmail.set(s.buyer.email, {
        email: s.buyer.email, name: s.buyer.name, orders: 1, total_spent: total,
        first_order_at: at, last_order_at: at, subscribed: s.buyer.subscribed,
      });
    } else {
      c.orders += 1;
      c.total_spent += total;
      if (at < c.first_order_at) c.first_order_at = at;
      if (at > c.last_order_at) c.last_order_at = at;
    }
  }
  return [...byEmail.values()].sort((a, b) => b.last_order_at.localeCompare(a.last_order_at));
}

/** Same rules as the backend's audiences. */
export function inAudience(customers: Customer[], audience: Audience, now = new Date()): Customer[] {
  const cutoff = new Date(now.getTime() - 60 * 86400000).toISOString();
  return customers.filter(c => c.subscribed && (audience === 'all' || (audience === 'repeat' ? c.orders >= 2 : c.last_order_at < cutoff)));
}
