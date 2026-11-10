import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { COUNTRIES, nextStep, type Order, type Product } from './data';
import { DAY_NAMES, DAYS, normalizePickup, type Pickup } from './pickup';
import type { Settings } from './settings';
import * as persist from './persist';
import { api, ApiError, LIVE, sellerIdFromToken, storeLink, type ApiOrder, type ApiProduct, type ApiSeller, type PlanResponse } from './api';
import { demoCost } from './demo';
import { designFromLegacy, normalizeDesign, type StoreDesign } from './design';
import { demoPlan } from './plan';
import { ACCENT_KEYS, demoProducts, initialState, usdConverter, type State } from './state';

export type { State } from './state';

const toOrder = (o: ApiOrder): Order => ({
  id: o.id,
  name: o.customer_name || o.email || 'Customer',
  place: o.email ?? '',
  item: o.items.map(i => (i.quantity > 1 ? `${i.title} ×${i.quantity}` : i.title)).join(', '),
  usd: 0,
  amount: o.total,
  intl: o.international,
  status: o.status,
  created_at: o.created_at,
  fulfillment: o.fulfillment === 'pickup' ? 'pickup' : 'delivery',
});

const toProduct = (p: ApiProduct): Product => ({ id: p.id, name: p.title, price: p.price, stock: p.stock, cost: p.cost_price });

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
    design: se.design ?? null,
    pickup: se.pickup ?? null,
    payout: se.payout ?? null,
    paystack: !!se.paystack_subaccount_code,
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
  const fromUsd = usdConverter(country.rate);
  const slug = (LIVE && s.handle) || (s.shopName || 'yourshop').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourshop';
  const shopNameShown = s.shopName.trim() || 'Your shop';
  const storeUrl = storeLink(slug);

  const products: Product[] = demoProducts(s, fromUsd);

  /** The store's design: what the seller saved, or their simple look converted. */
  const design: StoreDesign = normalizeDesign(
    s.design,
    designFromLegacy({ theme: s.theme, accent: s.accent, font: s.font, announce: s.announce, country: country.id === 'DI' ? 'Africa' : country.name }),
  );
  const setDesign = (change: (d: StoreDesign) => StoreDesign) => set({ design: change(design), designed: true });

  const toggleHelp = (k: string) => set(st => ({ help: { ...st.help, [k]: !st.help[k] } }));
  const advanceOrder = async (id: string) => {
    const order = s.orders.find(o => o.id === id);
    const next = order && nextStep(order)?.status;
    if (!next || next === 'new' || next === 'canceled') return;
    if (!LIVE) {
      set(st => ({ orders: st.orders.map(o => (o.id === id ? { ...o, status: next } : o)) }));
      return;
    }
    try {
      const { order: updated } = await api.updateOrder(s.token, id, next);
      set(st => ({ orders: st.orders.map(o => (o.id === id ? toOrder(updated) : o)) }));
    } catch (e) {
      fail(e);
    }
  };

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
    const [{ seller }, { products }, { orders }, plan] = await Promise.all([api.me(token), api.products(token), api.orders(token), api.plan(token)]);
    set({
      ...fromSeller(seller),
      token,
      products: products.map(toProduct),
      orders: orders.map(toOrder),
      plan,
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
  /** The product list with demo cost prices fixed in place, so later edits don't shift them. */
  const withCosts = () => products.map((p, i) => ({ ...p, cost: LIVE ? p.cost ?? null : demoCost(p, i) }));

  const addProduct = async () => {
    const name = s.newName.trim();
    if (!name) return;
    const price = Number(s.newPrice) || 0;
    const cost = s.newCost.trim() === '' ? null : Number(s.newCost);
    if (!LIVE) {
      set({ products: [{ name, price, stock: 1, cost }, ...withCosts()], newName: '', newPrice: '', newCost: '' });
      flash('Product added to your store');
      return;
    }
    set({ busy: true });
    try {
      const { product } = await api.addProduct(s.token, { title: name, price, stock: 1, ...(cost != null ? { cost_price: cost } : {}) });
      set(st => ({
        products: [toProduct(product), ...(st.products ?? [])],
        newName: '',
        newPrice: '',
        newCost: '',
        busy: false,
      }));
      flash('Product added to your store');
    } catch (e) {
      set({ busy: false });
      fail(e);
    }
  };

  /** Sets what one item of a product costs the seller (for profit). */
  const setProductCost = async (index: number, cost: number | null) => {
    const target = products[index];
    if (!target) return;
    if (!LIVE) {
      set({ products: withCosts().map((p, i) => (i === index ? { ...p, cost } : p)) });
      flash('Cost price saved');
      return;
    }
    if (!target.id) return;
    try {
      const { product } = await api.updateProduct(s.token, target.id, { cost_price: cost });
      set(st => ({ products: (st.products ?? []).map(p => (p.id === product.id ? toProduct(product) : p)) }));
      flash('Cost price saved');
    } catch (e) {
      fail(e);
    }
  };

  /** The seller's plan: from the backend (live), or worked out in the browser (demo). */
  const planInfo: PlanResponse | null = LIVE
    ? s.plan
    : demoPlan(s.country, s.demoTrialEndsAt, s.demoDomain, slug);

  const refreshPlan = async () => {
    if (!LIVE) return;
    try {
      set({ plan: await api.plan(s.token) });
    } catch (e) {
      fail(e);
    }
  };

  const startTrial = async () => {
    if (!LIVE) {
      set({ demoTrialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString() });
      flash('Your 14-day Pro trial has started');
      return;
    }
    try {
      set({ plan: await api.startTrial(s.token) });
      flash('Your Pro trial has started');
    } catch (e) {
      fail(e);
    }
  };

  /** Asks to upgrade; returns how to pay (online card payment opens with Paystack). */
  const requestUpgrade = async (): Promise<{ message: string; contact: string | null } | null> => {
    if (!LIVE) return { message: 'Demo: in the real app, sellers pay here. Online card payment opens with Paystack.', contact: null };
    try {
      const r = await api.upgrade(s.token);
      return { message: r.message, contact: r.billing_contact };
    } catch (e) {
      fail(e);
      return null;
    }
  };

  const connectDomain = async (domain: string): Promise<boolean> => {
    if (!LIVE) {
      const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(d)) {
        flash("That doesn't look like a domain. Type it like adirehouse.com");
        return false;
      }
      set({ demoDomain: d });
      return true;
    }
    try {
      set({ plan: await api.setDomain(s.token, domain) });
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const checkDomain = async (): Promise<boolean> => {
    if (!LIVE) {
      flash("Demo: the real app checks your domain's settings here");
      return false;
    }
    try {
      const r = await api.verifyDomain(s.token);
      set({ plan: r });
      return !!r.connected;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const removeDomain = async () => {
    if (!LIVE) {
      set({ demoDomain: '' });
      return;
    }
    try {
      set({ plan: await api.removeDomain(s.token) });
    } catch (e) {
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
      const { seller } = await api.updateMe(s.token, { design });
      set({ design: seller.design });
      set({ designed: true, busy: false });
      flash('Published. Your store has its new look');
    } catch (e) {
      set({ busy: false });
      fail(e);
    }
  };

  /** The seller's pickup settings (always complete; disabled until switched on). */
  const pickup: Pickup = normalizePickup(s.pickup);

  /** Saves pickup settings. Returns an error message to show next to the form, or '' when saved. */
  const savePickup = async (next: Pickup): Promise<string> => {
    if (next.enabled) {
      if (!next.address.trim()) return "Add your shop's address so customers can find you.";
      if (!next.area.trim()) return 'Add the area or neighbourhood (for example Lekki, Lagos).';
      if (!DAYS.some(d => next.hours[d])) return 'Open your shop on at least one day.';
      const bad = DAYS.find(d => { const h = next.hours[d]; return h && h.open >= h.close; });
      if (bad) return `On ${DAY_NAMES[bad]}, closing time must be after opening time.`;
    }
    const clean: Pickup = { ...next, address: next.address.trim(), area: next.area.trim(), instructions: next.instructions.trim() };
    if (!LIVE) {
      set({ pickup: clean });
      flash(clean.enabled ? 'Saved. Customers can now pick up from your shop' : 'Saved. Pickup is off');
      return '';
    }
    set({ busy: true });
    try {
      const { seller } = await api.updateMe(s.token, { pickup: clean });
      set({ pickup: seller.pickup, busy: false });
      flash(clean.enabled ? 'Saved. Customers can now pick up from your shop' : 'Saved. Pickup is off');
      return '';
    } catch (e) {
      set({ busy: false });
      return e instanceof Error ? e.message : 'Could not save. Please try again.';
    }
  };

  /** Connects the bank account sales are paid into. Returns an error to show by the form, or ''. */
  const savePayout = async (bank: { code: string; name: string }, accountNumber: string): Promise<string> => {
    const acct = accountNumber.replace(/\s+/g, '');
    if (!bank.code) return 'Choose your bank.';
    if (!/^[0-9A-Za-z]{6,20}$/.test(acct)) return 'Enter your account number (numbers only, no spaces).';
    if (!LIVE) {
      set({ paystack: true, payout: { bank_name: bank.name, bank_code: bank.code, account_last4: acct.slice(-4), account_name: null } });
      flash('Bank account connected. Sales are paid straight into it');
      return '';
    }
    set({ busy: true });
    try {
      const { seller } = await api.setPayout(s.token, { bank_code: bank.code, account_number: acct });
      set({ busy: false, paystack: !!seller.paystack_subaccount_code, payout: seller.payout });
      flash('Bank account connected. Sales are paid straight into it');
      return '';
    } catch (e) {
      set({ busy: false });
      return e instanceof Error ? e.message : 'Could not connect. Please try again.';
    }
  };

  return {
    pickup, savePickup, savePayout,
    s, set, settings, toast, flash, isMobile, framed, country, fmt, fromUsd, slug, shopNameShown, storeUrl,
    products, toggleHelp, advanceOrder, copyLink, shareWhatsApp, startOver,
    design, setDesign, planInfo, refreshPlan, startTrial, requestUpgrade, connectDomain, checkDomain, removeDomain, live: LIVE, submitAuth, finishOnboarding, addProduct, setProductCost, publishDesign, logOut, retryLoad,
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
