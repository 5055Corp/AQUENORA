import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  COUNTRIES, ORDERS, STATUS,
  type CountryId, type FontId, type Order, type OrderFilter, type Product, type Tab, type ThemeId,
} from './data';
import type { Settings } from './settings';
import * as persist from './persist';

export interface State {
  screen: 'onboarding' | 'app';
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
  /** null until the seller adds a product from the dashboard; until then the list is derived from onboarding. */
  products: Product[] | null;
  orders: Order[];
  filter: OrderFilter;
  newName: string;
  newPrice: string;
}

function initialState(settings: Settings): State {
  return {
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
  };
}

function useWindowWidth() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

/** Start state: fresh, or restored from the last visit. A ?screen= in the URL still picks the screen. */
function startState(settings: Settings): State {
  const fresh = initialState(settings);
  if (settings.reset) {
    persist.clear();
    // Drop ?reset from the address bar so a later refresh doesn't wipe the store again.
    const url = new URL(window.location.href);
    url.searchParams.delete('reset');
    window.history.replaceState(null, '', url);
    return fresh;
  }
  const restored = persist.load(fresh);
  return settings.screenFromUrl ? { ...restored, screen: fresh.screen, tab: fresh.tab } : restored;
}

function useStoreValue(settings: Settings) {
  const [s, setS] = useState(() => startState(settings));
  useEffect(() => persist.save(s), [s]);
  const set = useCallback((patch: Partial<State> | ((s: State) => Partial<State>)) => {
    setS(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const flash = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(''), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const width = useWindowWidth();
  const isMobile = settings.device === 'mobile' || (settings.device === 'auto' && width < 760);
  const framed = settings.device === 'mobile' && width >= 500;

  const country = COUNTRIES.find(x => x.id === s.country) ?? COUNTRIES[0];
  const fmt = (n: number | string) => country.sym + Math.round(Number(n) || 0).toLocaleString();
  const fromUsd = (u: number) => {
    const v = u * country.rate;
    return v > 1000 ? Math.round(v / 500) * 500 : Math.round(v);
  };
  const slug = (s.shopName || 'yourshop').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourshop';
  const shopNameShown = s.shopName.trim() || 'Your shop';
  const storeUrl = `https://${slug}.aqenora.com`;

  const products: Product[] = s.products ?? [
    { name: s.productName || 'Your first product', price: Number(s.productPrice) || 0, stock: 6 },
    { name: 'Adire tote bag', price: fromUsd(16), stock: 14 },
    { name: 'Silk head wrap', price: fromUsd(6), stock: 0 },
    { name: 'Indigo throw pillow', price: fromUsd(11), stock: 3 },
  ];

  const toggleHelp = (k: string) => set(st => ({ help: { ...st.help, [k]: !st.help[k] } }));
  const advanceOrder = (id: string) =>
    set(st => ({ orders: st.orders.map(o => (o.id === id ? { ...o, status: STATUS[o.status].next ?? o.status } : o)) }));

  const copyLink = () => {
    navigator.clipboard?.writeText(storeUrl).catch(() => {});
  };
  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`Visit my shop: ${storeUrl}`)}`, '_blank', 'noopener');
  };

  /** Wipe the demo store and go back to step 1 of setup (used between seller interviews). */
  const startOver = () => {
    persist.clear();
    setS(initialState({ ...settings, startScreen: 'onboarding' }));
    window.scrollTo(0, 0);
  };

  return {
    s, set, settings, toast, flash, isMobile, framed, country, fmt, fromUsd, slug, shopNameShown, storeUrl,
    products, toggleHelp, advanceOrder, copyLink, shareWhatsApp, startOver,
    showHints: settings.showHelpHints,
    h1Size: isMobile ? '30px' : '40px',
  };
}

export type Store = ReturnType<typeof useStoreValue>;

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ settings, children }: { settings: Settings; children: ReactNode }) {
  const value = useStoreValue(settings);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}
