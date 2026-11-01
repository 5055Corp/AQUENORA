import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  COUNTRIES, ORDERS, STATUS,
  type CountryId, type FontId, type Order, type OrderFilter, type Product, type Tab, type ThemeId,
} from './data';
import type { Settings } from './settings';
import * as persist from './persist';
import { api, ApiError, LIVE, sellerIdFromToken, type Accent, type ApiSeller } from './api';

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

const ACCENT_KEYS: Accent[] = ['terracotta', 'leaf', 'indigo', 'hibiscus'];

function initialState(settings: Settings): State {
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

function fromSeller(se: ApiSeller): Partial<State> {
  return {
    shopName: se.name,
    handle: se.handle,
    email: se.email,
    category: se.category,
    country: se.country_code,
    intl: se.sells_abroad,
    theme: se.theme,
    accent: Math.max(0, ACCENT_KEYS.indexOf(se.accent)),
    font: se.font,
    announce: se.announcement ?? '',
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
  if (LIVE) {
    const saved = persist.loadLive();
    if (!saved) return fresh;
    return {
      ...fresh,
      ...saved,
      // A login with no store yet goes straight to setup; otherwise load the store first.
      screen: sellerIdFromToken(saved.token) ? 'loading' : 'onboarding',
    };
  }
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
  const set = useCallback((patch: Partial<State> | ((s: State) => Partial<State>)) => {
    setS(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  // Demo mode saves the whole demo store; live mode saves only the login and local checklist ticks.
  useEffect(() => {
    if (!LIVE) persist.save(s);
    else if (s.token) persist.saveLive({ token: s.token, paystack: s.paystack, shared: s.shared, designed: s.designed });
  }, [s]);

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
  const slug = (LIVE && s.handle) || (s.shopName || 'yourshop').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourshop';
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

  // ---------------- live mode actions ----------------

  const logOut = (message?: string) => {
    persist.saveLive(null);
    setS({ ...initialState(settings), authMode: 'login', authError: message ?? '' });
    window.scrollTo(0, 0);
  };

  /** Shows a backend error; an expired login sends the seller back to the login screen. */
  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) logOut('Please log in again.');
    else flash(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
  };

  /** Loads the seller's store and products, then opens the dashboard. */
  const loadStore = async (token: string) => {
    const [{ seller }, { products }] = await Promise.all([api.me(token), api.products(token)]);
    set({
      ...fromSeller(seller),
      token,
      products: products.map(p => ({ id: p.id, name: p.title, price: p.price, stock: p.stock })),
      orders: [],
      screen: 'app',
      tab: 'home',
      busy: false,
      loadError: '',
    });
  };

  const retryLoad = () => {
    set({ loadError: '' });
    loadStore(s.token).catch(e => {
      if (e instanceof ApiError && e.status === 401) logOut('Please log in again.');
      else set({ loadError: e instanceof Error ? e.message : 'Could not load your store.' });
    });
  };

  // On start, a saved login with a store loads that store.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !LIVE || s.screen !== 'loading') return;
    started.current = true;
    retryLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAuth = async () => {
    const email = s.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return set({ authError: 'Enter a valid email address.' });
    if (s.authMode === 'signup' && s.password.length < 8) return set({ authError: 'Use at least 8 characters for your password.' });
    if (!s.password) return set({ authError: 'Enter your password.' });

    set({ busy: true, authError: '' });
    try {
      const { token } = s.authMode === 'signup'
        ? await api.register(email, s.password)
        : await api.login(email, s.password);
      set({ password: '', email });
      if (sellerIdFromToken(token)) {
        await loadStore(token);
      } else {
        // New login (or one that never finished setup): go through the setup steps.
        set({ token, screen: 'onboarding', step: 0, busy: false });
      }
    } catch (e) {
      set({ busy: false, authError: e instanceof Error ? e.message : 'Something went wrong. Please try again.' });
    }
  };

  /**
   * Saves the setup steps to the backend: creates the store, adds the first product
   * (unless skipped) and opens the dashboard.
   */
  const finishOnboarding = async (skip: boolean) => {
    if (!s.shopName.trim()) {
      set({ step: 1, nameError: 'Add your shop name first.' });
      return;
    }
    set({ busy: true, nameError: '' });
    try {
      let token = s.token;
      const details = { name: s.shopName.trim(), category: s.category, country_code: s.country, sells_abroad: s.intl };
      if (!sellerIdFromToken(token)) {
        await api.createSeller(token, details);
        // The old token was issued before the store existed; the refreshed one carries the store id.
        token = (await api.refresh(token)).token;
        set({ token });
      } else {
        await api.updateMe(token, details);
      }
      if (!skip) {
        if (s.productName.trim()) {
          await api.addProduct(token, { title: s.productName.trim(), price: Number(s.productPrice) || 0, stock: 1 });
        }
        await api.updateMe(token, { onboarding_completed: true });
      }
      await loadStore(token);
      if (!skip) flash('Your store is live at ' + slug + '.aqenora.com');
    } catch (e) {
      set({ busy: false });
      if (e instanceof ApiError && e.status === 422) set({ step: 1, nameError: e.message });
      else fail(e);
    }
  };

  /** Adds a product: saved to the backend in live mode, kept in the browser in demo mode. */
  const addProduct = async () => {
    const name = s.newName.trim();
    if (!name) return;
    const price = Number(s.newPrice) || 0;
    if (!LIVE) {
      set({ products: [{ name, price, stock: 1 }, ...products], newName: '', newPrice: '' });
      flash('Product added to your store');
      return;
    }
    set({ busy: true });
    try {
      const { product } = await api.addProduct(s.token, { title: name, price, stock: 1 });
      set(st => ({
        products: [{ id: product.id, name: product.title, price: product.price, stock: product.stock }, ...(st.products ?? [])],
        newName: '',
        newPrice: '',
        busy: false,
      }));
      flash('Product added to your store');
    } catch (e) {
      set({ busy: false });
      fail(e);
    }
  };

  /** Saves the store's look (live mode) and ticks the checklist item. */
  const publishDesign = async () => {
    if (!LIVE) {
      set({ designed: true });
      flash('Published. Your store has its new look');
      return;
    }
    set({ busy: true });
    try {
      await api.updateMe(s.token, {
        theme: s.theme,
        accent: ACCENT_KEYS[s.accent],
        font: s.font,
        announcement: s.announce.trim() || null,
      });
      set({ designed: true, busy: false });
      flash('Published. Your store has its new look');
    } catch (e) {
      set({ busy: false });
      fail(e);
    }
  };

  return {
    s, set, settings, toast, flash, isMobile, framed, country, fmt, fromUsd, slug, shopNameShown, storeUrl,
    products, toggleHelp, advanceOrder, copyLink, shareWhatsApp, startOver,
    live: LIVE, submitAuth, finishOnboarding, addProduct, publishDesign, logOut, retryLoad,
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
