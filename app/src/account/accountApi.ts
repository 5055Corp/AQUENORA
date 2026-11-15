// One AQUENORA account (email + password) for shopping and for selling, plus the shopping
// side's server calls (search, home, orders). The seller dashboard's own calls are in api.ts.
import { api, API_URL, ApiError, LIVE } from '../api';
import * as persist from '../persist';

const PUBLISHABLE_KEY: string = import.meta.env.VITE_MEDUSA_PUBLISHABLE_KEY ?? '';

async function call<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(path.startsWith('/store') ? { 'x-publishable-api-key': PUBLISHABLE_KEY } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach AQUENORA right now. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : '';
    if (path.startsWith('/auth') && res.status === 401) throw new ApiError(401, 'That email and password don’t match. Try again.');
    throw new ApiError(res.status, message && res.status < 500 ? message : 'Something went wrong on our side. Please try again.');
  }
  return data as T;
}

const exists = (e: unknown) => e instanceof ApiError && /exist/i.test(e.message);

// ---------------- shopper session ----------------

export interface Shopper { token: string; email: string; name: string }
const SHOPPER_KEY = 'aquenora-shopper';

export function loadShopper(): Shopper | null {
  try {
    const v = JSON.parse(localStorage.getItem(SHOPPER_KEY) ?? 'null');
    return v && typeof v.token === 'string' && v.token ? v : null;
  } catch {
    return null;
  }
}
export function saveShopper(v: Shopper | null) {
  try {
    if (v) localStorage.setItem(SHOPPER_KEY, JSON.stringify(v));
    else localStorage.removeItem(SHOPPER_KEY);
  } catch {
    /* storage unavailable */
  }
}

type Customer = { email: string; first_name: string | null; last_name: string | null };

/** Logs in to shopping (or creates the account). The same email and password also work for selling. */
export async function shopperAuth(email: string, password: string, signup: boolean, name = ''): Promise<Shopper> {
  let token: string;
  if (signup) {
    try {
      token = (await call<{ token: string }>('/auth/customer/emailpass/register', { body: { email, password } })).token;
    } catch (e) {
      // Already has an AQUENORA login (e.g. a seller): use it.
      if (!exists(e)) throw e;
      token = (await call<{ token: string }>('/auth/customer/emailpass', { body: { email, password } })).token;
    }
  } else {
    token = (await call<{ token: string }>('/auth/customer/emailpass', { body: { email, password } })).token;
  }
  let customer: Customer;
  try {
    customer = (await call<{ customer: Customer }>('/store/customers/me', { token })).customer;
  } catch {
    // First time shopping with this login: create the shopper profile, then get a token that carries it.
    const [first, ...rest] = (name || email.split('@')[0]).trim().split(/\s+/);
    customer = (await call<{ customer: Customer }>('/store/customers', { token, body: { email, first_name: first, last_name: rest.join(' ') || undefined } })).customer;
    token = (await call<{ token: string }>('/auth/customer/emailpass', { body: { email, password } })).token;
  }
  const shopper = { token, email: customer.email, name: [customer.first_name, customer.last_name].filter(Boolean).join(' ') };
  saveShopper(shopper);
  return shopper;
}

/** Logs in to the seller dashboard (or starts a new store). The dashboard picks the login up when it opens. */
export async function sellerAuth(email: string, password: string, signup: boolean): Promise<void> {
  let token: string;
  if (signup) {
    try {
      token = (await api.register(email, password)).token;
    } catch (e) {
      if (!exists(e) && !(e instanceof ApiError && /already/i.test(e.message))) throw e;
      token = (await api.login(email, password)).token;
    }
  } else {
    token = (await api.login(email, password)).token;
  }
  persist.saveLive({ token, paystack: false, shared: false, designed: false });
}

/** Emails a link to choose a new password (works for shopping and selling). */
export const requestPasswordReset = (email: string) =>
  call<unknown>('/auth/customer/emailpass/reset-password', { body: { identifier: email } });

export const setNewPassword = (token: string, password: string) =>
  call<unknown>('/auth/customer/emailpass/update', { token, body: { password } });

// ---------------- shopping ----------------

export interface MarketStore {
  handle: string;
  name: string;
  category: string;
  country_code: string;
  currency_code: string;
  sells_abroad: boolean;
  theme: string;
  accent: string;
  font: string;
  design: unknown;
  product_count: number;
}
export interface MarketProduct {
  id: string;
  title: string;
  description: string | null;
  price: number;
  currency_code: string;
  image: string;
  photo_count: number;
}
export interface SearchResult {
  query: string;
  total_products: number;
  stores: (MarketStore & { match_count: number; matches: MarketProduct[] })[];
}
export interface ShopHome {
  categories: { name: string; count: number }[];
  featured: MarketStore[];
  trending: (MarketProduct & { store: { handle: string; name: string } })[];
}
export interface ShopperOrder {
  id: string;
  display_id: number;
  created_at: string;
  store: { name: string; handle: string } | null;
  currency_code: string;
  status: string;
  fulfillment: 'pickup' | 'delivery';
  items: { title: string; quantity: number; unit_price: number; thumbnail: string | null }[];
  total: number;
}

const EMPTY_HOME: ShopHome = { categories: [], featured: [], trending: [] };

export const shopHome = (): Promise<ShopHome> => (LIVE ? call<ShopHome>('/store/marketplace/home') : Promise.resolve(EMPTY_HOME));

export function shopSearch(q: string, category?: string): Promise<SearchResult> {
  if (!LIVE) return Promise.resolve({ query: q, total_products: 0, stores: [] });
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (category) p.set('category', category);
  return call<SearchResult>(`/store/marketplace?${p}`);
}

export const myOrders = (token: string) => call<{ orders: ShopperOrder[] }>('/store/me/orders', { token });
