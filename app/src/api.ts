// Talks to the AQUENORA backend (backend/ in this repo). Only used when VITE_API_URL is set;
// without it the app runs as the browser-only demo.

import type { CountryId, FontId, ThemeId } from './data';

export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const LIVE = API_URL !== '';

/**
 * The domain shops live under, e.g. "aquenora.com" → adirehouse.aquenora.com. Leave unset until
 * the domain points at the web server; store links then use store.html?shop=<handle> instead.
 */
export const STORE_DOMAIN: string = (import.meta.env.VITE_STORE_DOMAIN ?? '').toLowerCase().replace(/^\.+|\.+$/g, '');

/** True for a hostname that isn't AQUENORA's own (or a dev/hosting address), i.e. a seller's domain. */
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
export const RESERVED_SUBDOMAINS = ['app', 'www', 'api', 'admin', 'mail', 'static', 'cdn', 'stores', 'store', 'shop', 'help', 'support', 'status', 'blog', 'docs', 'billing', 'pay', 'checkout', 'account', 'login', 'signup', 'aquenora', 'aqenora'];

/** A working link to a shop's store page. */
export function storeLink(handle: string): string {
  if (STORE_DOMAIN) return `https://${handle}.${STORE_DOMAIN}`;
  return new URL(`store.html?shop=${encodeURIComponent(handle)}`, window.location.href).href;
}

export type Accent = 'terracotta' | 'leaf' | 'indigo' | 'hibiscus';

export interface StoreCollection { id: string; name: string }

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type IdType = 'nin' | 'drivers_licence' | 'passport' | 'voters_card' | 'national_id';
export interface VerificationInfo {
  status: VerificationStatus;
  details: { type?: 'registered' | 'individual'; business_name?: string; cac_number?: string; id_type?: IdType; socials?: { instagram?: string; tiktok?: string; facebook?: string }; submitted_at?: string; reject_reason?: string | null } | null;
  verified_at: string | null;
}
export interface VerificationBody {
  type: 'registered' | 'individual';
  business_name?: string;
  cac_number?: string;
  id_type?: IdType;
  socials: { instagram?: string; tiktok?: string; facebook?: string };
  documents: { kind: 'cac' | 'id' | 'selfie'; mime_type: string; data: string }[];
}

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
  /** Shown in AQUENORA's shopping search. */
  marketplace_listed?: boolean;
  /** Anti-scam check by AQUENORA: only verified sellers can take payments. */
  verification_status?: VerificationStatus;
  /** Collections inside the store, in display order. */
  collections?: StoreCollection[] | null;
  /** Paused by AQUENORA (moderation). */
  suspended_at?: string | null;
  suspend_reason?: string | null;
  /** Full store design (see design.ts), or null if the seller hasn't customised it. */
  design: unknown;
  /** In-store pickup settings (see pickup.ts), or null if never set. */
  pickup: unknown;
  /** Ship-from address and delivery options (see shipping.ts), or null if never set. */
  shipping: unknown;
  /** The bank account sales are paid into (set once Paystack is connected). */
  payout: Payout | null;
  /** Bookings (service providers only). null = never set up. */
  booking_settings?: BookingSettings | null;
  /** The "Appointment booked" email in the provider's words (null = AQUENORA's default). */
  booking_email?: BookingEmail | null;
}

// ---- bookings (service providers) ----
export type Day = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export interface BookingSettings {
  enabled: boolean;
  timezone: string;
  address: string;
  hours: Record<Day, { from: string; to: string }[]>;
  buffer_min: number;
  min_notice_min: number;
  days_ahead: number;
  cancel_hours: number;
  /** Shown for "Contact to book" services. */
  phone?: string;
  contact_email?: string;
  /** Blocked-off time: breaks, days off, holidays (once or repeating). */
  blocks?: TimeBlock[];
  /** Team members customers can book (salons with more than one stylist). */
  staff?: Staff[];
  calendar_key?: string;
}
/** Once: `date` (to `end_date`). Repeating: on `days`, from `date` (until `end_date`). Wall-clock times. */
export interface TimeBlock { id: string; label: string; all_day: boolean; from: string; to: string; date: string; end_date?: string | null; days?: Day[]; staff_id?: string | null }
export interface Staff { id: string; name: string; title?: string; service_ids: string[] | null; hours: Record<Day, { from: string; to: string }[]> | null; active: boolean }
export interface BookingEmail { subject: string; message: string }
export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price: number;
  /** 'contact': listed, but customers get in touch to book (e.g. bridal). */
  payment: 'deposit' | 'full' | 'none' | 'contact';
  deposit_type: 'fixed' | 'percent';
  deposit_value: number;
  deposit: number;
  /** Extras the customer can add (more money and time), e.g. Hollywood waves. */
  addons?: Addon[];
  active: boolean;
  sort: number;
}
export interface Addon { id: string; name: string; price: number; duration_min: number }
export type ServiceInput = Partial<Pick<Service, 'name' | 'description' | 'duration_min' | 'price' | 'payment' | 'deposit_type' | 'deposit_value' | 'active'>> & { addons?: (Omit<Addon, 'id'> & { id?: string })[] };
export interface SellerBooking {
  id: string;
  service_id: string;
  service_name: string;
  staff_id?: string | null;
  staff_name?: string | null;
  duration_min: number;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  customer_name: string;
  email: string;
  phone: string;
  note: string | null;
  currency_code: string;
  price: number;
  deposit: number;
  paid: number;
  owed: number;
  tips: number;
  refund_due: number;
  refunded_at: string | null;
  cancelled_by: 'customer' | 'seller' | null;
}
export interface EmailAllowance {
  free_per_month: number;
  used_this_month: number;
  free_left: number;
  credits: number;
  price_per_email: number;
  currency_code: string;
  resets_at: string;
}
export interface CampaignSchedule {
  id: string;
  subject: string;
  message: string;
  audience: Audience;
  every: 'week' | 'month';
  next_run_at: string;
  active: boolean;
  last_sent_at: string | null;
  last_error: string | null;
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
  /** Photo addresses; the first is the main photo. */
  images?: string[];
  thumbnail?: string | null;
  description?: string | null;
  options?: import('./options').ProductOptions | null;
  made_to_order_days?: number | null;
  note_prompt?: string | null;
  /** Lowest price with options. */
  from_price?: number;
  /** Ids of the store's collections this product is in. */
  collections?: string[];
  /** Hidden from buyers by AQUENORA, with the reason. */
  hidden?: boolean;
  hidden_reason?: string | null;
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
  items: { title: string; quantity: number; unit_price: number; options?: { name: string; value: string }[]; note?: string | null }[];
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

export interface ProBilling {
  card_payments: boolean;
  /** What the card is charged each month (may be converted to AQUENORA's Paystack currency). */
  charge: { amount: number; currency_code: string } | null;
  card: { brand: string | null; last4: string | null; exp_month: string | null; exp_year: string | null } | null;
  auto_renew: boolean;
  next_charge_at: string | null;
  failures: number;
  last_error: string | null;
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
  /** Pro is paid by card through Paystack and renews monthly. */
  billing: ProBilling;
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
  /** e.g. 'device_unverified': this phone or computer must be confirmed with an emailed code. */
  type: string;
  constructor(status: number, message: string, type = '') {
    super(message);
    this.status = status;
    this.type = type;
  }
}

/** This device's random id, so AQUENORA can ask for an emailed code when a seller signs in somewhere new. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem('aq-device');
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem('aq-device', id);
    }
    return id;
  } catch {
    return 'nostorage-' + Math.random().toString(36).slice(2).padEnd(12, '0');
  }
}

/** "iPhone", "Chrome on Mac"... shown in the sign-in code email. */
export function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : '';
  const app = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() ? 'AQUENORA app'
    : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'a browser';
  return os ? `${app} on ${os}` : app;
}

async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(path.startsWith('/sellers') ? { 'x-aq-device': deviceId() } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach AQUENORA right now. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, friendly(res.status, path, data?.message), typeof data?.type === 'string' ? data.type : '');
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
  store: Pick<ApiSeller, 'id' | 'name' | 'handle' | 'category' | 'country_code' | 'currency_code' | 'sells_abroad' | 'theme' | 'accent' | 'font' | 'announcement' | 'design' | 'collections'> & { show_badge?: boolean; pickup?: unknown; accepts_payments?: boolean; verified?: boolean; bookings?: boolean; shipping?: { ships_from: string | null; options: unknown[] } };
  products: ApiProduct[];
}

/** The public data for one store page. 404 means there is no store at that address. */
/** Store visits: this week day by day (oldest first), last week's total, and sources. */
export interface VisitStats { days: string[]; by_day: number[]; week: number; previous_week: number; sources: Record<string, number> }

export type VisitSource = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'google' | 'aquenora' | 'direct' | 'other';

/** Counts one store visit (only a count by source is kept). Never throws. */
export function recordVisit(handle: string, source: VisitSource) {
  fetch(`${storeApi()}/store/sellers/${encodeURIComponent(handle)}/visit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-publishable-api-key': PUBLISHABLE_KEY },
    body: JSON.stringify({ source }),
    keepalive: true,
  }).catch(() => {});
}

/** An order's progress for the buyer (from their tracking link). */
export interface TrackedOrder {
  order: {
    display_id: number;
    created_at: string;
    status: 'new' | 'shipped' | 'delivered' | 'ready' | 'collected' | 'canceled';
    fulfillment: 'delivery' | 'pickup';
    currency_code: string;
    items: { title: string; quantity: number; unit_price: number; note: string | null }[];
    total: number;
    shipping: { name: string; price: number; days: string } | null;
    made_to_order_days: number | null;
    place: string | null;
    pickup_address: string | null;
  };
  store: { name: string; handle: string; whatsapp: string | null };
  dispute: Dispute | null;
}

/** A buyer's problem with an order. Sellers refund buyers directly; AQUENORA can step in. */
export type DisputeReason = 'not_arrived' | 'wrong_item' | 'damaged' | 'not_as_described' | 'other';
export interface Dispute {
  id: string;
  order_id: string;
  order_display_id: number;
  reason: DisputeReason;
  reason_label: string;
  status: 'open' | 'replied' | 'refunded' | 'escalated' | 'resolved';
  messages: { from: 'buyer' | 'seller' | 'aquenora'; text: string; at: string; files?: string[] }[];
  refund: { amount: number; note?: string; at: string; file?: string } | null;
  decision: { outcome: 'refund_required' | 'seller'; note: string; amount?: number; due?: string } | null;
  reply_by: string;
  can_escalate: boolean;
}
export interface PhotoFile { mime_type: string; data: string }

async function storeSend<T>(path: string, method: 'POST' | 'PATCH', body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${storeApi()}${path}`, { method, headers: { 'content-type': 'application/json', 'x-publishable-api-key': PUBLISHABLE_KEY }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(0, "Can't reach the shop right now. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { message?: string }).message ?? 'Something went wrong. Please try again.');
  return data as T;
}

export const openDispute = (token: string, body: { reason: DisputeReason; message: string; files?: PhotoFile[] }) =>
  storeSend<{ dispute: Dispute }>(`/store/orders/track/${encodeURIComponent(token)}/dispute`, 'POST', body);
export const buyerDisputeAction = (token: string, body: { action: 'message' | 'confirm' | 'escalate'; text?: string; files?: PhotoFile[] }) =>
  storeSend<{ dispute: Dispute }>(`/store/orders/track/${encodeURIComponent(token)}/dispute`, 'PATCH', body);
export const buyerDisputeFileUrl = (token: string, file: string) => `${storeApi()}/store/orders/track/${encodeURIComponent(token)}/dispute/files/${file}`;
/** "Email me when it's back": a shopper waits for a sold-out product (or one choice of it). */
export const notifyWhenBack = (productId: string, body: { email: string; choice?: string }) =>
  storeSend<{ waiting: true }>(`/store/products/${encodeURIComponent(productId)}/notify`, 'POST', body);
export const reportProduct = (productId: string, body: { reason: 'counterfeit' | 'prohibited' | 'misleading' | 'offensive' | 'scam' | 'other'; note?: string }) =>
  storeSend<{ reported: true }>(`/store/products/${encodeURIComponent(productId)}/report`, 'POST', body);

// ---- bookings: the customer side (store page) ----
export type PayChoice = 'deposit' | 'full' | 'later';
export interface BookingPage {
  shop: { name: string; handle: string; address: string; timezone: string; cancel_hours: number; days_ahead: number; currency_code: string; phone?: string | null; email?: string | null };
  fee_percent: number;
  staff?: { id: string; name: string; title: string | null; service_ids: string[] | null }[];
  services: (Service & { pay_choices: PayChoice[] })[];
}
export interface CustomerBooking {
  id: string; service_id?: string; service_name: string; staff_id?: string | null; staff_name?: string | null; duration_min: number; starts_at: string; ends_at: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show'; customer_name: string; currency_code: string;
  price: number; paid: number; owed: number; tips: number; refund_due: number; refunded: boolean; can_change: boolean; cancel_hours: number; timezone: string;
  shop: { name: string; handle: string; address: string };
}
async function storeGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${storeApi()}${path}`, { headers: { 'x-publishable-api-key': PUBLISHABLE_KEY } });
  } catch {
    throw new ApiError(0, "Can't reach the shop right now. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { message?: string }).message ?? 'Something went wrong. Please try again.');
  return data as T;
}
export const bookingApi = {
  page: (handle: string) => storeGet<BookingPage>(`/store/sellers/${encodeURIComponent(handle)}/booking`),
  slots: (handle: string, serviceId: string, date: string, addons: string[] = [], staff?: string | null) =>
    storeGet<{ slots: string[] }>(`/store/sellers/${encodeURIComponent(handle)}/booking/slots?service_id=${encodeURIComponent(serviceId)}&date=${date}${addons.length ? `&addons=${addons.map(encodeURIComponent).join(',')}` : ''}${staff ? `&staff=${encodeURIComponent(staff)}` : ''}`),
  book: (handle: string, body: { service_id: string; starts_at: string; name: string; email: string; phone: string; note?: string; pay: PayChoice; return_url: string; marketing_opt_in?: boolean; addon_ids?: string[]; staff_id?: string | null }) =>
    storeSend<{ booking: CustomerBooking; token: string; payment_url: string | null }>(`/store/sellers/${encodeURIComponent(handle)}/booking`, 'POST', body),
  verify: (reference: string) => storeSend<{ status: 'paid' | 'pending' | 'failed'; kind: string; booking: CustomerBooking; token: string }>('/store/booking-payments/verify', 'POST', { reference }),
  get: (token: string) => storeGet<{ booking: CustomerBooking; online: boolean; fee_percent: number }>(`/store/bookings/${encodeURIComponent(token)}`),
  act: (token: string, body: { action: 'cancel' } | { action: 'reschedule'; starts_at: string } | { action: 'pay_balance'; return_url: string } | { action: 'tip'; amount: number; return_url: string }) =>
    storeSend<{ booking?: CustomerBooking; payment_url?: string }>(`/store/bookings/${encodeURIComponent(token)}`, 'POST', body),
  /** Free times to move this booking to (its own length and team member). */
  moveSlots: (token: string, date: string) => storeGet<{ slots: string[] }>(`/store/bookings/${encodeURIComponent(token)}/slots?date=${date}`),
  calendarFile: (token: string) => `${storeApi()}/bookings/${encodeURIComponent(token)}/calendar`,
};

export async function fetchTracking(token: string): Promise<TrackedOrder> {
  let res: Response;
  try {
    res = await fetch(`${storeApi()}/store/orders/track/${encodeURIComponent(token)}`, { headers: { 'x-publishable-api-key': PUBLISHABLE_KEY } });
  } catch {
    throw new ApiError(0, "Can't reach the shop right now. Check your internet connection and try again.");
  }
  if (res.status === 404) throw new ApiError(404, "We couldn't find that order. Check the link in your email.");
  if (!res.ok) throw new ApiError(res.status, 'Your order could not be loaded. Please try again.');
  return res.json();
}

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
  items: { product_id: string; quantity: number; choices?: string[]; note?: string }[];
}

export interface CheckoutLine { product_id: string; title: string; quantity: number; unit_price: number }

export type PaymentResult =
  | { status: 'paid'; order: { id: string; display_id: number }; checkout: { amount: number; currency_code: string; fulfillment: 'delivery' | 'pickup'; items: CheckoutLine[]; shipping?: OrderShipping | null }; track_token?: string }
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

/** Sends a potential seller's interview answers (market research). */
export const submitInterview = (body: {
  version: string;
  answers: { id: string; section: string; question: string; answer: string | string[] }[];
  name?: string; phone?: string; email?: string;
  contact_ok: boolean; wants_early_access: boolean;
  country?: string; source?: string; website?: string;
}) => storePost<{ ok: boolean }>('/store/interviews', body);

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

  /** Email a 6-digit code to confirm this device. */
  sendDeviceCode: (token: string) => request<{ sent_to: string }>('/sellers/me/device-code', { token, body: { device_name: deviceName() } }),
  verifyDeviceCode: (token: string, code: string) => request<{ trusted: true }>('/sellers/me/device-code/verify', { token, body: { code } }),
  savePushToken: (token: string, push: string) => request<{ saved: boolean }>('/sellers/me/push-token', { token, body: { token: push } }),
  forgetPushToken: (token: string, push: string) => request<{ saved: boolean }>('/sellers/me/push-token', { token, method: 'DELETE', body: { token: push } }),
  /** The seller's invite link and how many friends joined / made a first sale. */
  referrals: (token: string) => request<{ link: string; joined: number; rewarded: number }>('/sellers/me/referrals', { token }),
  createSeller: (token: string, body: { name: string; category: string; country_code: CountryId; sells_abroad: boolean; referral?: string }) =>
    request<{ seller: ApiSeller }>('/sellers', { body, token }),
  me: (token: string) => request<{ seller: ApiSeller }>('/sellers/me', { token }),
  deleteAccount: (token: string) => request<{ deleted: true }>('/sellers/me', { method: 'DELETE', token }),
  verification: (token: string) => request<{ verification: VerificationInfo }>('/sellers/me/verification', { token }),
  submitVerification: (token: string, body: VerificationBody) =>
    request<{ verification: VerificationInfo }>('/sellers/me/verification', { body, token }),
  updateMe: (token: string, body: Partial<Omit<ApiSeller, 'id' | 'email' | 'currency_code' | 'paystack_subaccount_code' | 'payout'>>) =>
    request<{ seller: ApiSeller }>('/sellers/me', { body, token }),

  products: (token: string) => request<{ products: ApiProduct[] }>('/sellers/me/products', { token }),
  addProduct: (token: string, body: { title: string; price: number; stock?: number; cost_price?: number; images?: string[]; options?: import('./options').ProductOptions | null; made_to_order_days?: number | null; note_prompt?: string | null; collections?: string[] }) =>
    request<{ product: ApiProduct }>('/sellers/me/products', { body, token }),
  /** Many products at once, from the seller's spreadsheet. */
  importProducts: (token: string, products: import('./productCsv').ImportRow[]) =>
    request<{ created: number; failed: { row: number; title: string; message: string }[] }>('/sellers/me/product-imports', { body: { products }, token }),
  updateProduct: (token: string, id: string, body: { title?: string; price?: number; stock?: number; cost_price?: number | null; images?: string[]; description?: string; options?: import('./options').ProductOptions | null; made_to_order_days?: number | null; note_prompt?: string | null; collections?: string[] }) =>
    request<{ product: ApiProduct }>(`/sellers/me/products/${encodeURIComponent(id)}`, { body, token }),
  deleteProduct: (token: string, id: string) => request<{ id: string; deleted: true }>(`/sellers/me/products/${id}`, { token, method: 'DELETE' }),
  disputes: (token: string) => request<{ disputes: Dispute[] }>('/sellers/me/disputes', { token }),
  /** Shoppers waiting for a sold-out product: { productId: { choice ('' = the product): count } }. */
  stockAlerts: (token: string) => request<{ waiting: Record<string, Record<string, number>> }>('/sellers/me/stock-alerts', { token }),
  disputeAction: (token: string, id: string, body: { action: 'message' | 'refunded'; text?: string; amount?: number; files?: PhotoFile[] }) =>
    request<{ dispute: Dispute }>(`/sellers/me/disputes/${id}`, { token, body }),
  /** A dispute photo as an object URL (the request needs the seller's login). */
  disputeFile: async (token: string, id: string, file: string) => {
    const res = await fetch(`${API_URL}/sellers/me/disputes/${id}/files/${file}`, { headers: { authorization: `Bearer ${token}`, 'x-aq-device': deviceId() } });
    if (!res.ok) throw new ApiError(res.status, 'Could not load the photo.');
    return URL.createObjectURL(await res.blob());
  },

  orders: (token: string) => request<{ orders: ApiOrder[] }>('/sellers/me/orders', { token }),
  updateOrder: (token: string, id: string, status: 'shipped' | 'delivered' | 'ready' | 'collected') =>
    request<{ order: ApiOrder }>(`/sellers/me/orders/${encodeURIComponent(id)}`, { body: { status }, token }),

  finance: (token: string, period: Period) => request<Finance>(`/sellers/me/finance?period=${period}`, { token }),

  customers: (token: string) =>
    request<{ customers: Customer[]; audiences: Record<Audience, number> }>('/sellers/me/customers', { token }),
  campaigns: (token: string) => request<{ campaigns: Campaign[] }>('/sellers/me/campaigns', { token }),
  plan: (token: string) => request<PlanResponse>('/sellers/me/plan', { token }),
  visits: (token: string) => request<{ visits: VisitStats }>('/sellers/me/visits', { token }),
  startTrial: (token: string) => request<PlanResponse>('/sellers/me/plan/trial', { method: 'POST', token }),
  /** Starts paying for Pro by card: returns Paystack's payment page. */
  upgrade: (token: string, return_url: string) =>
    request<{ reference: string; authorization_url: string; amount: number; currency_code: string }>('/sellers/me/plan/upgrade', { body: { return_url }, token }),
  confirmPro: (token: string, reference: string) =>
    request<PlanResponse & { status: 'paid' | 'pending' | 'failed'; message?: string }>('/sellers/me/plan/confirm', { body: { reference }, token }),
  autoRenew: (token: string, on: boolean) => request<PlanResponse>('/sellers/me/plan/auto-renew', { body: { on }, token }),
  setDomain: (token: string, domain: string) => request<PlanResponse>('/sellers/me/domain', { body: { domain }, token }),
  verifyDomain: (token: string) => request<PlanResponse>('/sellers/me/domain/verify', { method: 'POST', token }),
  removeDomain: (token: string) => request<PlanResponse>('/sellers/me/domain', { method: 'DELETE', token }),

  uploadImage: (token: string, body: { kind: 'logo' | 'banner' | 'product'; mime_type: string; data: string }) =>
    request<{ url: string }>('/sellers/me/uploads', { body, token }),

  banks: (token: string) => request<{ banks: Bank[] }>('/sellers/me/payouts/banks', { token }),
  setPayout: (token: string, body: { bank_code: string; account_number: string }) =>
    request<{ seller: ApiSeller }>('/sellers/me/payouts', { body, token }),

  // ---- bookings ----
  services: (token: string) => request<{ services: Service[] }>('/sellers/me/services', { token }),
  addService: (token: string, body: ServiceInput) => request<{ service: Service }>('/sellers/me/services', { token, body }),
  updateService: (token: string, id: string, body: ServiceInput) => request<{ service: Service }>(`/sellers/me/services/${encodeURIComponent(id)}`, { token, body }),
  deleteService: (token: string, id: string) => request<{ deleted: boolean }>(`/sellers/me/services/${encodeURIComponent(id)}`, { token, method: 'DELETE' }),
  bookings: (token: string, from?: string, to?: string) =>
    request<{ bookings: SellerBooking[]; stats: { today: number; next_7_days: number; paid_online: number; tips: number; refunds_due: number }; timezone: string }>(
      `/sellers/me/bookings${from ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to ?? '')}` : ''}`, { token }),
  bookingAction: (token: string, id: string, body: { action: 'complete' | 'no_show' | 'refunded' | 'cancel'; reason?: string }) =>
    request<{ booking: SellerBooking }>(`/sellers/me/bookings/${encodeURIComponent(id)}`, { token, body }),
  addBooking: (token: string, body: { service_id: string; starts_at: string; name: string; phone?: string; email?: string; note?: string; paid?: number; addon_ids?: string[]; price?: number; staff_id?: string | null }) =>
    request<{ booking: SellerBooking }>('/sellers/me/bookings', { token, body }),
  calendarLink: (token: string, renew = false) => request<{ url: string; webcal: string }>('/sellers/me/booking-calendar', { token, body: { renew } }),
  // ---- email blasts ----
  emailAllowance: (token: string) => request<{ allowance: EmailAllowance }>('/sellers/me/email-allowance', { token }),
  buyEmails: (token: string, count: number, return_url: string) =>
    request<{ payment_url: string; amount: number; currency_code: string }>('/sellers/me/email-credits', { token, body: { count, return_url } }),
  confirmEmails: (token: string, reference: string) => request<{ status: string; count: number; credits: number | null }>('/sellers/me/email-credits/verify', { token, body: { reference } }),
  schedules: (token: string) => request<{ schedules: CampaignSchedule[] }>('/sellers/me/campaign-schedules', { token }),
  addSchedule: (token: string, body: { subject: string; message: string; audience: Audience; every: 'week' | 'month'; first_send_at: string }) =>
    request<{ schedule: CampaignSchedule }>('/sellers/me/campaign-schedules', { token, body }),
  setSchedule: (token: string, id: string, active: boolean) => request<{ schedule: CampaignSchedule }>(`/sellers/me/campaign-schedules/${encodeURIComponent(id)}`, { token, body: { active } }),
  deleteSchedule: (token: string, id: string) => request<{ deleted: boolean }>(`/sellers/me/campaign-schedules/${encodeURIComponent(id)}`, { token, method: 'DELETE' }),
  sendCampaign: (token: string, body: { audience: Audience; subject: string; message: string }) =>
    request<{ campaign: Campaign }>('/sellers/me/campaigns', { body, token }),
};
