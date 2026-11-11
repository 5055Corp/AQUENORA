// Plans in the seller app. Live mode gets everything from GET /sellers/me/plan; the browser-only
// demo works it out here with the same rules (backend/apps/backend/src/lib/plans.ts).

import type { PlanResponse } from './api';
import type { CountryId } from './data';

/** Starting Pro prices (about USD 25), same as the backend defaults. */
export const DEMO_PRICES: Record<CountryId, { currency_code: string; monthly_price: number }> = {
  NG: { currency_code: 'ngn', monthly_price: 38500 },
  GH: { currency_code: 'ghs', monthly_price: 375 },
  ZA: { currency_code: 'zar', monthly_price: 450 },
  CI: { currency_code: 'xof', monthly_price: 15000 },
  SN: { currency_code: 'xof', monthly_price: 15000 },
  DI: { currency_code: 'usd', monthly_price: 25 },
};

const SETTINGS = { free_commission_percent: 3, pro_commission_percent: 1, trial_days: 14 };

export function demoPlan(country: CountryId, trialEndsAt: string | null, domain: string, handle: string, now = new Date()): PlanResponse {
  const trial = !!trialEndsAt && new Date(trialEndsAt) > now;
  return {
    plan: {
      plan: trial ? 'pro' : 'free',
      status: trial ? 'trial' : 'free',
      trial_ends_at: trialEndsAt,
      pro_paid_until: null,
      trial_used: !!trialEndsAt,
      show_badge: true,
      commission_percent: trial ? SETTINGS.pro_commission_percent : SETTINGS.free_commission_percent,
      features: { custom_domain: trial, full_financials: trial, campaign_interval_days: trial ? 1 : 7 },
    },
    price: DEMO_PRICES[country],
    settings: SETTINGS,
    domain: domain
      ? {
          name: domain,
          connected: false,
          records: [
            { type: 'CNAME', host: 'www', value: 'stores.aquenora.com', note: `Makes www.${domain} open your store.` },
            { type: 'Forwarding', host: '@', value: `https://www.${domain}`, note: `Sends ${domain} to www.${domain}.` },
          ],
        }
      : null,
    buy_domain_url: `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(handle)}`,
    billing: { card_payments: true, charge: DEMO_PRICES[country] ? { amount: DEMO_PRICES[country].monthly_price, currency_code: DEMO_PRICES[country].currency_code } : null, card: null, auto_renew: false, next_charge_at: null, failures: 0, last_error: null },
  };
}

/** Whole days left until a date (at least 0). */
export function daysLeft(iso: string | null, now = new Date()): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000));
}

const SYMBOLS: Record<string, string> = { ngn: '₦', ghs: 'GH₵', zar: 'R', xof: 'CFA ', usd: '$' };

/** "₦38,500" from { currency_code: 'ngn', monthly_price: 38500 }. */
export function formatPrice(price: { currency_code: string; monthly_price: number } | null): string {
  if (!price) return '';
  return (SYMBOLS[price.currency_code] ?? price.currency_code.toUpperCase() + ' ') + price.monthly_price.toLocaleString();
}
