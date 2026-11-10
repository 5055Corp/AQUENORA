// App state shape and starting values, shared by the seller app (store.tsx) and the store page.
import {
  ORDERS,
  type CountryId, type FontId, type Order, type OrderFilter, type Product, type Tab, type ThemeId,
} from './data';
import type { Settings } from './settings';
import { LIVE, type Accent, type Campaign, type PlanResponse } from './api';

export interface State {
  /** 'auth' and 'loading' are only used when connected to the backend (live mode). */
  screen: 'auth' | 'loading' | 'onboarding' | 'app';
  tab: Tab;
  step: number;
  category: string;
  shopName: string;
  country: CountryId;
  productName: string;
  productPrice: string;
  paystack: boolean;
  intl: boolean;
  help: Record<string, boolean>;
  theme: ThemeId;
  accent: number;
  font: FontId;
  announce: string;
  pv: 'phone' | 'desktop';
  shared: boolean;
  designed: boolean;
  /** Demo: null until the seller adds a product from the dashboard; until then the list is derived from onboarding. */
  products: Product[] | null;
  orders: Order[];
  filter: OrderFilter;
  newName: string;
  newPrice: string;
  newCost: string;

  /** The full store design. null = not customised yet; the simple theme/accent/font above is used. */
  design: unknown;
  /** Live mode: the seller's plan, price and domain (GET /sellers/me/plan). */
  plan: PlanResponse | null;
  /** Demo mode only: a pretend Pro trial and domain. */
  demoTrialEndsAt: string | null;
  demoDomain: string;
  /** Demo mode only: campaigns "sent" in this browser. */
  campaigns: Campaign[];

  // ---- live mode ----
  authMode: 'signup' | 'login';
  email: string;
  password: string;
  token: string;
  /** The store's web address as saved on the server (may differ from the name-derived one). */
  handle: string;
  busy: boolean;
  authError: string;
  /** Shown under the shop name, e.g. when the web address is taken. */
  nameError: string;
  /** Set when the store couldn't be loaded (e.g. offline); the loading screen offers a retry. */
  loadError: string;
}

export const ACCENT_KEYS: Accent[] = ['terracotta', 'leaf', 'indigo', 'hibiscus'];

export function initialState(settings: Settings): State {
  const base: State = {
    screen: settings.startScreen === 'onboarding' ? 'onboarding' : 'app',
    tab: settings.startScreen === 'theme-editor' ? 'design' : 'home',
    step: 0,
    category: 'Fashion & clothing',
    shopName: 'Adire House',
    country: 'NG',
    productName: 'Indigo adire kimono',
    productPrice: '28000',
    paystack: false,
    intl: true,
    help: {},
    theme: 'harmattan',
    accent: 0,
    font: 'classic',
    announce: 'Free delivery in Lagos this week',
    pv: 'phone',
    shared: false,
    designed: false,
    products: null,
    orders: ORDERS,
    filter: 'all',
    newName: '',
    newPrice: '',
    newCost: '',
    campaigns: [],
    design: null,
    plan: null,
    demoTrialEndsAt: null,
    demoDomain: '',
    authMode: 'signup',
    email: '',
    password: '',
    token: '',
    handle: '',
    busy: false,
    authError: '',
    nameError: '',
    loadError: '',
  };
  if (!LIVE) return base;
  // A real seller starts with empty fields and no demo orders or products.
  return {
    ...base,
    screen: 'auth',
    tab: 'home',
    shopName: '',
    productName: '',
    productPrice: '',
    announce: '',
    products: [],
    orders: [],
  };
}

/** The demo store's product list: the seller's own products, or sample ones until they add any. */
export function demoProducts(s: State, fromUsd: (usd: number) => number): Product[] {
  return s.products ?? [
    { name: s.productName || 'Your first product', price: Number(s.productPrice) || 0, stock: 6 },
    { name: 'Adire tote bag', price: fromUsd(16), stock: 14 },
    { name: 'Silk head wrap', price: fromUsd(6), stock: 0 },
    { name: 'Indigo throw pillow', price: fromUsd(11), stock: 3 },
  ];
}

/** Converts a USD amount to the seller's currency, rounded like the prototype. */
export function usdConverter(rate: number) {
  return (u: number) => {
    const v = u * rate;
    return v > 1000 ? Math.round(v / 500) * 500 : Math.round(v);
  };
}
