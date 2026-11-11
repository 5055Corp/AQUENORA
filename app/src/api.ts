// Talks to the AQENORA backend (backend/ in this repo). Only used when VITE_API_URL is set;
// without it the app runs as the browser-only demo.

import type { CountryId, FontId, ThemeId } from './data';

export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const LIVE = API_URL !== '';

/**
 * The domain shops live under, e.g. "aqenora.com" → adirehouse.aqenora.com. Leave unset until
 * the domain points at the web server; store links then use store.html?shop=<handle> instead.
 */
export const STORE_DOMAIN: string = (import.meta.env.VITE_STORE_DOMAIN ?? '').toLowerCase().replace(/^\.+|\.+$/g, '');

/** True for a hostname that isn't AQENORA's own (or a dev/hosting address), i.e. a seller's domain. */
export function isOwnDomain(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || /^[\d.]+$/.test(h) || h.endsWith('.github.io') || h.endsWith('.up.railway.app')) return false;
  return !(STORE_DOMAIN && (h === STORE_DOMAIN || h.endsWith('.' + STORE_DOMAIN)));
}

/**
 * Where store pages send /store requests. On a seller's own domain (www.adirehouse.com) the
 * Cloudflare Worker (cloudflare/store-worker.js) passes /store/* on to the backend, so requests
 * stay on the same address and need no cross-site permission.
 */
function storeApi(): string {
  return typeof window !== 'undefined' && LIVE && STORE_DOMAIN && isOwnDomain(window.location.hostname) ? window.location.origin : API_URL;
}

/** Subdomains that are never shops (keep in sync with RESERVED in server.mjs). */
export const RESERVED_SUBDOMAINS = ['app', 'www', 'api', 'admin', 'mail', 'static', 'cdn', 'stores', 'store', 'shop', 'help', 'support', 'status', 'blog', 'docs', 'billing', 'pay', 'checkout', 'account', 'login', 'signup', 'aqenora'];

/** A working link to a shop's store page. */
export function storeLink(handle: string): string {
  if (STORE_DOMAIN) return `https://${handle}.${STORE_DOMAIN}`;
  return new URL(`store.html?shop=${encodeURIComponent(handle)}`, window.location.href).href;
}

export type Accent = 'terracotta' | 'leaf' | 'indigo' | 'hibiscus';

export interface ApiSeller {
  id: string;
  email: string;
  name: string;
  handle: string;
  category: string;
  country_code: CountryId;
  currency_code: string;
  sells_abroad: boolean;
  paystack_subaccount_code: string | null;
  theme: ThemeId;
  accent: Accent;
  font: FontId;
  announcement: string | null;
  onboarding_completed: boolean;
  /** Full store design (see design.ts), or null if the seller hasn't customised it. */
  design: unknown;
  /** In-store pickup settings (see pickup.ts), or null if never set. */
  pickup: unknown;
  /** Ship-from address and delivery options (see shipping.ts), or null if never set. */
  shipping: unknown;
  /** The bank account sales are paid into (set once Paystack is connected). */
  payout: Payout | null;
}

export interface Payout {
  bank_name: string;
  bank_code: string;
  account_last4: string;
  account_name: string | null;
}

export interface Bank { name: string; code: string }

/** The delivery option a buyer chose (price in the seller's currency). */
export interface OrderShipping { carrier: string; name: string; price: number; days: string }
export interface OrderAddress { address: string; city: string; region: string; postal_code: string; country: string }

export interface ApiProduct {
  id: string;
  title: string;
  price: number;
  currency_code: string | null;
  stock: number;
  /** What one item costs the seller; null until they enter it. */
  cost_price: number | null;
  status: string;
}

export type SellerOrderStatus = 'new' | 'shipped' | 'delivered' | 'ready' | 'collected' | 'canceled';

export interface ApiOrder {
  id: string;
  display_id: number;
  created_at: string;
  customer_name: string | null;
  email: string | null;
  currency_code: string;
  status: SellerOrderStatus;
  international: boolean;
  fulfillment?: 'delivery' | 'pickup';
  shipping?: OrderShipping | null;
  phone?: string | null;
  address?: OrderAddress | null;
  display_currency?: string | null;
  items: { title: string; quantity: number; unit_price: number }[];
  total: number;
}

export type Period = '7d' | '30d' | 'all';

export interface Finance {
  currency_code: string;
  period: Period;
  granularity: 'day' | 'month';
  commission_rate: number;
  fee_basis: 'estimate' | 'actual';
  totals: {
    orders: number;
    items_sold: number;
    revenue: number;
    cost_of_goods: number;
    payment_fees: number;
    platform_fees: number;
    profit: number;
    items_missing_cost: number;
  };
  series: { date: string; revenue: number; profit: number }[];
  /** Free plan: charts and profit per product are hidden (Pro feature). */
  locked?: boolean;
  by_product: { product_id: string | null; title: string; quantity: number; revenue: number; cost: number; profit: number }[];
}

export type Audience = 'all' | 'repeat' | 'lapsed';

export interface PlanInfo {
  plan: 'free' | 'pro';
  status: 'free' | 'trial' | 'paid';
  trial_ends_at: string | null;
  pro_paid_until: string | null;
  trial_used: boolean;
  show_badge: boolean;
  commission_percent: number;
  features: { custom_domain: boolean; full_financials: boolean; campaign_interval_days: number };
}

export interface DomainInfo {
  name: string;
  connected: boolean;
  records: { type: string; host: string; value: string; note: string }[];
}

export interface PlanResponse {
  plan: PlanInfo;
  price: { currency_code: string; monthly_price: number } | null;
  settings: { free_commission_percent: number; pro_commission_percent: number; trial_days: number };
  domain: DomainInfo | null;
  buy_domain_url: string;
  billing_contact: string | null;
  /** Only from the verify call. */
  connected?: boolean;
  /** Only from the verify call: HTTPS certificate progress at Cloudflare ("off" = not automated). */
  https?: 'active' | 'pending' | 'error' | 'off';
}

export interface Customer {
  email: string;
  name: string | null;
  orders: number;
  total_spent: number;
  first_order_at: string;
  last_order_at: string;
  subscribed: boolean;
}

export interface Campaign {
  id: string;
  subject: string;
  message: string;
  audience: Audience;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
}

/** An error from the backend, with a message that's fine to show the seller. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach AQENORA right now. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, friendly(res.status, path, data?.message));
  }
  return data as T;
}

function friendly(status: number, path: string, message?: string): string {
  if (path.startsWith('/auth/seller/emailpass/register') && message?.toLowerCase().includes('exists')) {
    return 'There is already a store with this email. Log in instead.';
  }
  if (path.startsWith('/auth/seller/emailpass') && status === 401) {
    return 'That email and password don’t match. Try again.';
  }
  if (status === 401) return 'Please log in again.';
  if (message && status < 500) return message;
  return 'Something went wrong on our side. Please try again.';
}

/** Reads the seller id from a login token, without verifying it (the server does that). */
export function sellerIdFromToken(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.actor_id === 'string' ? payload.actor_id : '';
  } catch {
    return '';
  }
}

/** Medusa's publishable key: required by the public /store routes the store page uses. */
const PUBLISHABLE_KEY: string = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY ?? '';

export interface PublicStore {
  store: Pick<ApiSeller, 'id' | 'name' | 'handle' | 'category' | 'country_code' | 'currency_code' | 'sells_abroad' | 'theme' | 'accent' | 'font' | 'announcement' | 'design'> & { show_badge?: boolean; pickup?: unknown; accepts_payments?: boolean; shipping?: { ships_from: string | null; options: unknown[] } };
  products: ApiProduct[];
}

/** The public data for one store page. 404 means there is no store at that address. */
export async function fetchPublicStore(handle: string): Promise<PublicStore> {
  let res: Response;
  try {
    res = await fetch(`${storeApi()}/store/sellers/${encodeURIComponent(handle)}`, {
      headers: { 'x-publishable-api-key': PUBLISHABLE_KEY },
    });
  } catch {
    throw new ApiError(0, "Can't reach this store right now. Check your internet connection and try again.");
  }
  if (res.status === 404) throw new ApiError(404, 'not found');
  if (!res.ok) throw new ApiError(res.status, 'This store could not be loaded. Please try again.');
  return res.json();
}

export interface CheckoutRequest {
  email: string;
  name: string;
  phone: string;
  fulfillment: 'delivery' | 'pickup';
  address?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  shipping_option_id?: string;
  display_currency?: string;
  marketing_opt_in: boolean;
  return_url: string;
  items: { product_id: string; quantity: number }[];
}

export interface CheckoutLine { product_id: string; title: string; quantity: number; unit_price: number }

export type PaymentResult =
  | { status: 'paid'; order: { id: string; display_id: number }; checkout: { amount: number; currency_code: string; fulfillment: 'delivery' | 'pickup'; items: CheckoutLine[]; shipping?: OrderShipping | null } }
  | { status: 'pending' | 'failed'; message: string; checkout: { amount: number; fulfillment: 'delivery' | 'pickup'; items: CheckoutLine[] } | null };

/** POSTs to a public /store route; errors carry the backend's message (e.g. "Only 2 left of Kimono."). */
async function storePost<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${storeApi()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-publishable-api-key': PUBLISHABLE_KEY },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the shop right now. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, res.status < 500 && data?.message ? data.message : 'Something went wrong. Please try again.');
  return data as T;
}

/** Starts paying: returns Paystack's payment page to send the buyer to. */
export const startCheckout = (handle: string, body: CheckoutRequest) =>
  storePost<{ reference: string; authorization_url: string }>(`/store/sellers/${encodeURIComponent(handle)}/checkout`, body);

/** After Paystack sends the buyer back: did the payment go through? */
export const verifyPayment = (reference: string) => storePost<PaymentResult>('/store/payments/verify', { reference });

/** Exchange rates (units per USD) for showing prices in buyers' currencies; null if unavailable. */
export async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`${storeApi()}/store/rates`, { headers: { 'x-publishable-api-key': PUBLISHABLE_KEY } });
    if (!res.ok) return null;
    const j = (await res.json()) as { rates?: Record<string, number> };
    return j.rates ?? null;
  } catch {
    return null;
  }
}

/** Which store a seller's own domain opens (null if none is connected). */
export async function fetchHandleForDomain(host: string): Promise<string | null> {
  try {
    const res = await fetch(`${storeApi()}/store/domains/${encodeURIComponent(host)}`, { headers: { 'x-publishable-api-key': PUBLISHABLE_KEY } });
    if (!res.ok) return null;
    return ((await res.json()) as { handle?: string }).handle ?? null;
  } catch {
    return null;
  }
}

export const api = {
  register: (email: string, password: string) =>
    request<{ token: string }>('/auth/seller/emailpass/register', { body: { email, password } }),
  login: (email: string, password: string) =>
    request<{ token: string }>('/auth/seller/emailpass', { body: { email, password } }),
  /** A fresh token; after creating the store it carries the new seller id. */
  refresh: (token: string) => request<{ token: string }>('/auth/token/refresh', { method: 'POST', token }),

  createSeller: (token: string, body: { name: string; category: string; country_code: CountryId; sells_abroad: boolean }) =>
    request<{ seller: ApiSeller }>('/sellers', { body, token }),
  me: (token: string) => request<{ seller: ApiSeller }>('/sellers/me', { token }),
  updateMe: (token: string, body: Partial<Omit<ApiSeller, 'id' | 'email' | 'currency_code' | 'paystack_subaccount_code' | 'payout'>>) =>
    request<{ seller: ApiSeller }>('/sellers/me', { body, token }),

  products: (token: string) => request<{ products: ApiProduct[] }>('/sellers/me/products', { token }),
  addProduct: (token: string, body: { title: string; price: number; stock?: number; cost_price?: number }) =>
    request<{ product: ApiProduct }>('/sellers/me/products', { body, token }),
  updateProduct: (token: string, id: string, body: { title?: string; price?: number; stock?: number; cost_price?: number | null }) =>
    request<{ product: ApiProduct }>(`/sellers/me/products/${encodeURIComponent(id)}`, { body, token }),

  orders: (token: string) => request<{ orders: ApiOrder[] }>('/sellers/me/orders', { token }),
  updateOrder: (token: string, id: string, status: 'shipped' | 'delivered' | 'ready' | 'collected') =>
    request<{ order: ApiOrder }>(`/sellers/me/orders/${encodeURIComponent(id)}`, { body: { status }, token }),

  finance: (token: string, period: Period) => request<Finance>(`/sellers/me/finance?period=${period}`, { token }),

  customers: (token: string) =>
    request<{ customers: Customer[]; audiences: Record<Audience, number> }>('/sellers/me/customers', { token }),
  campaigns: (token: string) => request<{ campaigns: Campaign[] }>('/sellers/me/campaigns', { token }),
  plan: (token: string) => request<PlanResponse>('/sellers/me/plan', { token }),
  startTrial: (token: string) => request<PlanResponse>('/sellers/me/plan/trial', { method: 'POST', token }),
  upgrade: (token: string) =>
    request<{ payment: string; message: string; billing_contact: string | null }>('/sellers/me/plan/upgrade', { method: 'POST', token }),
  setDomain: (token: string, domain: string) => request<PlanResponse>('/sellers/me/domain', { body: { domain }, token }),
  verifyDomain: (token: string) => request<PlanResponse>('/sellers/me/domain/verify', { method: 'POST', token }),
  removeDomain: (token: string) => request<PlanResponse>('/sellers/me/domain', { method: 'DELETE', token }),

  uploadImage: (token: string, body: { kind: 'logo' | 'banner'; mime_type: string; data: string }) =>
    request<{ url: string }>('/sellers/me/uploads', { body, token }),

  banks: (token: string) => request<{ banks: Bank[] }>('/sellers/me/payouts/banks', { token }),
  setPayout: (token: string, body: { bank_code: string; account_number: string }) =>
    request<{ seller: ApiSeller }>('/sellers/me/payouts', { body, token }),

  sendCampaign: (token: string, body: { audience: Audience; subject: string; message: string }) =>
    request<{ campaign: Campaign }>('/sellers/me/campaigns', { body, token }),
};
