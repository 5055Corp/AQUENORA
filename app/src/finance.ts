// Demo-mode copy of the backend's profit maths (backend/apps/backend/src/lib/finance.ts), so the
// browser-only demo can show a realistic Money page. Live mode always uses the backend's numbers.

import type { CountryId } from './data';
import type { Finance, Period } from './api';

export const COMMISSION_RATE = 0.02;

/** Paystack's published fee for one payment (same rules as the backend; estimates). */
export function estimatePaymentFee(country: CountryId, amount: number, international = false): number {
  if (amount <= 0) return 0;
  const r = (n: number) => Math.round(n * 100) / 100;
  switch (country) {
    case 'NG':
      if (international) return r(amount * 0.039 + 100);
      return r(Math.min(amount * 0.015 + (amount < 2500 ? 0 : 100), 2000));
    case 'GH':
      return r(amount * 0.0195);
    case 'ZA':
      return r((amount * (international ? 0.031 : 0.029) + 1) * 1.15);
    default:
      return r(amount * 0.039);
  }
}

export interface DemoSale {
  date: Date;
  international: boolean;
  items: { title: string; quantity: number; unit_price: number; cost_price: number | null }[];
}

/** Same output shape as GET /sellers/me/finance. */
export function summarize(sales: DemoSale[], country: CountryId, currency: string, period: Period, now = new Date()): Finance {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 0;
  const start = days ? new Date(now) : null;
  if (start) {
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
  }
  const counted = sales.filter(s => !start || s.date >= start);
  const t = { orders: counted.length, items_sold: 0, revenue: 0, cost_of_goods: 0, payment_fees: 0, platform_fees: 0, profit: 0, items_missing_cost: 0 };
  const byProduct = new Map<string, Finance['by_product'][number]>();
  const buckets = new Map<string, { revenue: number; profit: number }>();
  const key = (d: Date) => {
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
    return days ? iso.slice(0, 10) : iso.slice(0, 7);
  };

  for (const s of counted) {
    const revenue = s.items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
    const cost = s.items.reduce((a, i) => a + i.quantity * (i.cost_price ?? 0), 0);
    const fee = estimatePaymentFee(country, revenue, s.international);
    const platform = Math.round(revenue * COMMISSION_RATE * 100) / 100;
    const profit = revenue - cost - fee - platform;
    t.revenue += revenue;
    t.cost_of_goods += cost;
    t.payment_fees += fee;
    t.platform_fees += platform;
    t.profit += profit;
    for (const i of s.items) {
      t.items_sold += i.quantity;
      if (i.cost_price == null) t.items_missing_cost += i.quantity;
      const lineRevenue = i.quantity * i.unit_price;
      const share = revenue ? lineRevenue / revenue : 0;
      const p = byProduct.get(i.title) ?? { product_id: null, title: i.title, quantity: 0, revenue: 0, cost: 0, profit: 0 };
      p.quantity += i.quantity;
      p.revenue += lineRevenue;
      p.cost += i.quantity * (i.cost_price ?? 0);
      p.profit += lineRevenue - i.quantity * (i.cost_price ?? 0) - (fee + platform) * share;
      byProduct.set(i.title, p);
    }
    const b = buckets.get(key(s.date)) ?? { revenue: 0, profit: 0 };
    b.revenue += revenue;
    b.profit += profit;
    buckets.set(key(s.date), b);
  }

  let keys: string[];
  if (start) {
    keys = [];
    const d = new Date(start);
    while (d <= now) {
      keys.push(key(d));
      d.setDate(d.getDate() + 1);
    }
  } else {
    keys = [...buckets.keys()].sort();
  }

  return {
    currency_code: currency,
    period,
    granularity: days ? 'day' : 'month',
    commission_rate: COMMISSION_RATE,
    fee_basis: 'estimate',
    totals: t,
    series: keys.map(k => ({ date: k, revenue: buckets.get(k)?.revenue ?? 0, profit: buckets.get(k)?.profit ?? 0 })),
    by_product: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue),
  };
}
