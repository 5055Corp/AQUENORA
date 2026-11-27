import { maybeAskForRating, startPush, stopPush } from './native';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { COUNTRIES, nextStep, SERVICE_CATEGORY, type Order, type Product } from './data';
import { defaultBookingSettings } from './bookings';
import { DAY_NAMES, DAYS, normalizePickup, type Pickup } from './pickup';
import { normalizeShipping, type Shipping } from './shipping';
import { prepareImage, type ImageKind } from './images';
import type { ProductOptions } from './options';
import type { Settings } from './settings';
import * as persist from './persist';
import { api, ApiError, LIVE, sellerIdFromToken, storeLink, type ApiOrder, type ApiProduct, type ApiSeller, type PlanResponse, type VerificationBody, type PhotoFile, type StoreCollection } from './api';
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
  shipping: o.shipping ?? null,
  phone: o.phone ?? null,
  address: o.address ?? null,
  email: o.email,
  displayCurrency: o.display_currency ?? null,
  items: o.items,
});

/** A photo kept as a data: address, back into a file for uploading. */
async function dataUrlToFile(url: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], 'product.jpg', { type: blob.type || 'image/jpeg' });
}

const toProduct = (p: ApiProduct): Product => ({ id: p.id, name: p.title, price: p.price, stock: p.stock, cost: p.cost_price, images: p.images ?? [], description: p.description ?? null, options: p.options ?? null, madeToOrderDays: p.made_to_order_days ?? null, notePrompt: p.note_prompt ?? null, hiddenReason: p.hidden ? p.hidden_reason || 'It breaks AQUENORA rules.' : null, collections: p.collections ?? [] });

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
    shipping: se.shipping ?? null,
    payout: se.payout ?? null,
    paystack: !!se.paystack_subaccount_code,
    listed: se.marketplace_listed !== false,
    verification: se.verification_status ?? 'verified',
    suspended: se.suspended_at ? se.suspend_reason || 'Contact AQUENORA support.' : '',
    collections: se.collections ?? [],
    bookings: se.booking_settings ?? null,
    bookingEmail: se.booking_email ?? null,
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
    // ?from=whatsapp lets the store's visit stats show WhatsApp as the source.
    window.open(`https://wa.me/?text=${encodeURIComponent(`Visit my shop: ${storeUrl}${storeUrl.includes('?') ? '&' : '?'}from=whatsapp`)}`, '_blank', 'noopener');
  };

  /** Wipe the demo store and go back to step 1 of setup (used between seller interviews). */
  const startOver = () => {
    persist.clear();
    setS(initialState({ ...settings, startScreen: 'onboarding' }));
    window.scrollTo(0, 0);
  };

  // ---------------- live mode actions ----------------

  const logOut = (message?: string) => {
    // This iPhone stops getting the store's notifications (needs the old login, so before clearing it).
    if (s.token) stopPush(push => api.forgetPushToken(s.token, push));
    persist.saveLive(null);
    setS({ ...initialState(settings), authMode: 'login', authError: message ?? '' });
    window.scrollTo(0, 0);
  };

  /** Shows or hides the store in AQUENORA's shopping search. */
  const setListed = async (listed: boolean) => {
    const before = s.listed;
    set({ listed });
    if (!LIVE) return;
    try {
      await api.updateMe(s.token, { marketplace_listed: listed });
      flash(listed ? 'Your store shows in AQUENORA search' : 'Your store is hidden from AQUENORA search');
    } catch (e) {
      set({ listed: before });
      fail(e);
    }
  };

  /** Saves the store's collections ("Wigs", "Bundles"...). Returns an error message, or '' when saved. */
  const setCollections = async (collections: StoreCollection[]): Promise<string> => {
    const before = s.collections;
    set({ collections });
    if (!LIVE) return '';
    try {
      await api.updateMe(s.token, { collections });
      return '';
    } catch (e) {
      set({ collections: before });
      return e instanceof Error ? e.message : 'Could not save. Please try again.';
    }
  };

  /** Bookings on/off, hours and rules. Returns an error message, or '' when saved. */
  const saveBookings = async (bookings: import('./api').BookingSettings): Promise<string> => {
    const before = s.bookings;
    set({ bookings });
    if (!LIVE) return '';
    try {
      const { calendar_key: _k, ...body } = bookings;
      void _k;
      await api.updateMe(s.token, { booking_settings: body });
      return '';
    } catch (e) {
      set({ bookings: before });
      return e instanceof Error ? e.message : 'Could not save. Please try again.';
    }
  };

  /** The "Appointment booked" email (null = AQUENORA's default). */
  const saveBookingEmail = async (bookingEmail: import('./api').BookingEmail | null): Promise<string> => {
    const before = s.bookingEmail;
    set({ bookingEmail });
    if (!LIVE) return '';
    try {
      await api.updateMe(s.token, { booking_email: bookingEmail });
      return '';
    } catch (e) {
      set({ bookingEmail: before });
      return e instanceof Error ? e.message : 'Could not save. Please try again.';
    }
  };

  /** Deletes the seller's account and store for good, then returns to the login screen. */
  const deleteAccount = async () => {
    if (!s.token) return;
    await api.deleteAccount(s.token);
    logOut('Your account has been deleted.');
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
    // iPhone notifications for new orders and problems; tapping one opens that tab.
    startPush(push => api.savePushToken(token, push), tab => set({ tab: (['home', 'orders', 'products', 'settings'].includes(tab) ? tab : 'home') as State['tab'] }));
    // Happy sellers (3+ paid orders) are asked once to rate the iPhone app.
    maybeAskForRating(orders.filter(o => o.status !== 'canceled').length);
    // Problems buyers reported (shown on Orders).
    api.disputes(token).then(r => set({ disputes: r.disputes })).catch(() => {});
    // Shoppers waiting for sold-out products (shown on Products).
    api.stockAlerts(token).then(r => set({ waiting: r.waiting })).catch(() => {});
    // A rejected seller sees why, so they can fix it and send again.
    if (seller.verification_status === 'rejected') {
      api.verification(token).then(({ verification: v }) => set({ verifyReason: v.details?.reject_reason ?? '' })).catch(() => {});
    }
  };

  /** Sends the seller's documents for AQUENORA to check. Returns an error message, or '' when sent. */
  const submitVerification = async (body: VerificationBody): Promise<string> => {
    if (!LIVE) {
      set({ verification: 'pending', verifyReason: '' });
      flash("Sent. We'll email you when you're verified.");
      return '';
    }
    try {
      const { verification: v } = await api.submitVerification(s.token, body);
      set({ verification: v.status, verifyReason: '' });
      flash("Sent. We'll email you when you're verified.");
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not send. Check your connection and try again.';
    }
  };

  /** A new device: email a code and show the code screen. */
  const askDeviceCode = async (token: string) => {
    if (!LIVE) return set({ deviceSentTo: 'a******@gmail.com' });
    set({ token, screen: 'device', busy: false, deviceError: '', deviceSentTo: '' });
    try {
      const { sent_to } = await api.sendDeviceCode(token);
      set({ deviceSentTo: sent_to });
    } catch (e) {
      set({ deviceError: e instanceof Error ? e.message : 'Could not send the code. Try again.' });
    }
  };
  const isNewDevice = (e: unknown) => e instanceof ApiError && e.type === 'device_unverified';

  /** Checks the emailed code; the right one opens the store. Returns an error message, or ''. */
  const confirmDevice = async (code: string): Promise<string> => {
    if (!LIVE) {
      set({ screen: 'app' });
      return '';
    }
    set({ busy: true, deviceError: '' });
    try {
      await api.verifyDeviceCode(s.token, code);
      await loadStore(s.token);
      return '';
    } catch (e) {
      set({ busy: false });
      return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
    }
  };
  const resendDeviceCode = () => askDeviceCode(s.token);

  const retryLoad = () => {
    set({ loadError: '' });
    loadStore(s.token).catch(e => {
      if (isNewDevice(e)) askDeviceCode(s.token);
      else if (e instanceof ApiError && e.status === 401) logOut('Please log in again.');
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
    let token = '';
    try {
      ({ token } = s.authMode === 'signup'
        ? await api.register(email, s.password)
        : await api.login(email, s.password));
      set({ password: '', email });
      if (sellerIdFromToken(token)) {
        await loadStore(token);
      } else {
        // New login (or one that never finished setup): go through the setup steps.
        set({ token, screen: 'onboarding', step: 0, busy: false });
      }
    } catch (e) {
      if (isNewDevice(e) && token) return askDeviceCode(token);
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
        await api.createSeller(token, { ...details, ...(s.referral ? { referral: s.referral } : {}) });
        try { localStorage.removeItem('aq-ref'); } catch { /* storage unavailable */ }
        // The old token was issued before the store existed; the refreshed one carries the store id.
        token = (await api.refresh(token)).token;
        set({ token });
      } else {
        await api.updateMe(token, details);
      }
      const services = s.category === SERVICE_CATEGORY;
      // Service providers get bookings switched on, with their first service ready to book.
      if (services) await api.updateMe(token, { booking_settings: defaultBookingSettings(s.country) });
      if (!skip && services) {
        if (s.productName.trim()) {
          await api.addService(token, { name: s.productName.trim(), price: Number(s.productPrice) || 0, duration_min: s.serviceMinutes, payment: 'none' });
        }
        await api.updateMe(token, { onboarding_completed: true });
      } else if (!skip) {
        if (s.productName.trim()) {
          // The photo chosen during set-up is uploaded now that the store exists.
          let images: string[] = [];
          if (s.productPhoto) {
            try {
              const img = await prepareImage(await dataUrlToFile(s.productPhoto), 'product');
              images = [(await api.uploadImage(token, { kind: 'product', mime_type: img.mimeType, data: img.base64 })).url];
            } catch {
              // The product is still added; the photo can be added again from Products.
            }
          }
          await api.addProduct(token, { title: s.productName.trim(), price: Number(s.productPrice) || 0, stock: 1, ...(images.length ? { images } : {}) });
        }
        await api.updateMe(token, { onboarding_completed: true });
      }
      await loadStore(token);
      if (!skip) flash('Your store is live at ' + slug + '.aquenora.com');
    } catch (e) {
      set({ busy: false });
      if (e instanceof ApiError && e.status === 422) set({ step: 1, nameError: e.message });
      else fail(e);
    }
  };

  /** Adds a product: saved to the backend in live mode, kept in the browser in demo mode. */
  /** The product list with demo cost prices fixed in place, so later edits don't shift them. */
  const withCosts = () => products.map((p, i) => ({ ...p, cost: LIVE ? p.cost ?? null : demoCost(p, i) }));

  const addProduct = async (images: string[] = [], extras: { options?: ProductOptions | null; madeToOrderDays?: number | null; notePrompt?: string } = {}) => {
    const name = s.newName.trim();
    if (!name) return;
    const price = Number(s.newPrice) || 0;
    const cost = s.newCost.trim() === '' ? null : Number(s.newCost);
    const options = extras.options ?? null;
    if (!LIVE) {
      const stock = options?.stock_per_choice ? options.groups[0].choices.reduce((a, c) => a + (c.stock ?? 0), 0) : 1;
      set({ products: [{ name, price, stock, cost, images, options, madeToOrderDays: extras.madeToOrderDays ?? null, notePrompt: extras.notePrompt || null }, ...withCosts()], newName: '', newPrice: '', newCost: '' });
      flash('Product added to your store');
      return true;
    }
    set({ busy: true });
    try {
      const { product } = await api.addProduct(s.token, {
        title: name,
        price,
        stock: 1,
        ...(cost != null ? { cost_price: cost } : {}),
        ...(images.length ? { images } : {}),
        ...(options ? { options } : {}),
        ...(extras.madeToOrderDays ? { made_to_order_days: extras.madeToOrderDays } : {}),
        ...(extras.notePrompt ? { note_prompt: extras.notePrompt } : {}),
      });
      set(st => ({
        products: [toProduct(product), ...(st.products ?? [])],
        newName: '',
        newPrice: '',
        newCost: '',
        busy: false,
      }));
      flash('Product added to your store');
      return true;
    } catch (e) {
      set({ busy: false });
      fail(e);
      return false;
    }
  };

  /** Adds many products from the seller's spreadsheet. Returns how many were added and which rows failed. */
  const importProducts = async (rows: import('./productCsv').ImportRow[]): Promise<{ created: number; failed: { row: number; title: string; message: string }[] }> => {
    if (!LIVE) {
      const added = rows.map(r => ({
        name: r.title, price: r.price, stock: r.stock ?? 1, cost: r.cost_price ?? null, images: [],
        options: r.options ?? null, madeToOrderDays: r.made_to_order_days ?? null, notePrompt: null,
      }));
      set({ products: [...added, ...withCosts()] });
      flash(`${rows.length} products added to your store`);
      return { created: rows.length, failed: [] };
    }
    const res = await api.importProducts(s.token, rows);
    const { products: fresh } = await api.products(s.token);
    set({ products: fresh.map(toProduct) });
    if (res.created) flash(`${res.created} products added to your store`);
    return res;
  };

  /** Replaces a product's photos (first = main photo). Returns an error message, or '' when saved. */
  const setProductImages = async (index: number, images: string[]): Promise<string> => {
    const target = products[index];
    if (!target) return 'Product not found.';
    if (!LIVE) {
      set({ products: withCosts().map((p, i) => (i === index ? { ...p, images } : p)) });
      return '';
    }
    if (!target.id) return 'Product not found.';
    try {
      const { product } = await api.updateProduct(s.token, target.id, { images });
      set(st => ({ products: (st.products ?? []).map(p => (p.id === product.id ? toProduct(product) : p)) }));
      return '';
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logOut('Please log in again.');
      return e instanceof Error ? e.message : 'Could not save the photos. Please try again.';
    }
  };

  /** Saves changes to a product (name, price, stock, description, cost). Returns an error message, or '' when saved. */
  const editProduct = async (index: number, changes: { name?: string; price?: number; stock?: number; description?: string; cost?: number | null; options?: ProductOptions | null; madeToOrderDays?: number | null; notePrompt?: string; collections?: string[] }): Promise<string> => {
    const target = products[index];
    if (!target) return 'Product not found.';
    if (changes.name !== undefined && !changes.name.trim()) return 'Add a product name.';
    if (!LIVE) {
      set({
        products: withCosts().map((p, i) => {
          if (i !== index) return p;
          const next = { ...p, ...changes, name: changes.name?.trim() ?? p.name, notePrompt: changes.notePrompt !== undefined ? changes.notePrompt || null : p.notePrompt };
          const o = next.options;
          return o?.stock_per_choice ? { ...next, stock: o.groups[0].choices.reduce((a, c) => a + (c.stock ?? 0), 0) } : next;
        }),
      });
      flash('Product saved');
      return '';
    }
    if (!target.id) return 'Product not found.';
    try {
      const { product } = await api.updateProduct(s.token, target.id, {
        ...(changes.name !== undefined ? { title: changes.name.trim() } : {}),
        ...(changes.price !== undefined ? { price: changes.price } : {}),
        ...(changes.stock !== undefined ? { stock: changes.stock } : {}),
        ...(changes.description !== undefined ? { description: changes.description.trim() } : {}),
        ...(changes.cost !== undefined ? { cost_price: changes.cost } : {}),
        ...(changes.options !== undefined ? { options: changes.options } : {}),
        ...(changes.madeToOrderDays !== undefined ? { made_to_order_days: changes.madeToOrderDays } : {}),
        ...(changes.notePrompt !== undefined ? { note_prompt: changes.notePrompt || null } : {}),
        ...(changes.collections !== undefined ? { collections: changes.collections } : {}),
      });
      set(st => ({ products: (st.products ?? []).map(p => (p.id === product.id ? toProduct(product) : p)) }));
      flash('Product saved');
      return '';
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logOut('Please log in again.');
      return e instanceof Error ? e.message : 'Could not save. Please try again.';
    }
  };

  /** Deletes a product for good (past orders keep their details). Returns an error message, or '' when deleted. */
  const deleteProduct = async (index: number): Promise<string> => {
    const target = products[index];
    if (!target) return 'Product not found.';
    if (!LIVE) {
      set({ products: withCosts().filter((_, i) => i !== index) });
      flash(target.name + ' deleted');
      return '';
    }
    if (!target.id) return 'Product not found.';
    try {
      await api.deleteProduct(s.token, target.id);
      set(st => ({ products: (st.products ?? []).filter(p => p.id !== target.id) }));
      flash(target.name + ' deleted');
      return '';
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logOut('Please log in again.');
      return e instanceof Error ? e.message : 'Could not delete. Please try again.';
    }
  };

  /** The seller replies to a buyer's problem, or marks it refunded. Returns an error message, or '' when done. */
  const disputeAction = async (id: string, body: { action: 'message' | 'refunded'; text?: string; amount?: number; files?: PhotoFile[] }): Promise<string> => {
    if (!LIVE) {
      set(st => ({
        disputes: st.disputes.map(d => d.id !== id ? d : {
          ...d,
          status: body.action === 'refunded' ? 'refunded' : d.status === 'open' ? 'replied' : d.status,
          refund: body.action === 'refunded' ? { amount: body.amount ?? 0, note: body.text, at: new Date().toISOString() } : d.refund,
          messages: [...d.messages, { from: 'seller', text: body.action === 'refunded' ? `Refunded ${body.amount}${body.text ? `: ${body.text}` : ''}` : body.text ?? '', at: new Date().toISOString() }],
        }),
      }));
      flash(body.action === 'refunded' ? 'Marked as refunded. The buyer will confirm.' : 'Reply sent');
      return '';
    }
    try {
      const { dispute } = await api.disputeAction(s.token, id, body);
      set(st => ({ disputes: st.disputes.map(d => (d.id === id ? dispute : d)) }));
      flash(body.action === 'refunded' ? 'Marked as refunded. The buyer will confirm.' : 'Reply sent');
      return '';
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) logOut('Please log in again.');
      return e instanceof Error ? e.message : 'Could not send. Please try again.';
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

  /** Upgrade to Pro: opens Paystack's card page. The card is then charged each month. */
  const requestUpgrade = async (): Promise<void> => {
    if (!LIVE) {
      flash("Demo: in the real app, Paystack's card page opens here");
      return;
    }
    set({ busy: true });
    try {
      const back = new URL(window.location.href);
      back.search = '';
      back.hash = '';
      const { authorization_url } = await api.upgrade(s.token, back.toString());
      window.location.assign(authorization_url);
    } catch (e) {
      set({ busy: false });
      fail(e);
    }
  };

  /** Stop or restart the monthly card charge. */
  const setAutoRenew = async (on: boolean) => {
    if (!LIVE) return;
    set({ busy: true });
    try {
      set({ plan: await api.autoRenew(s.token, on), busy: false });
      flash(on ? 'Pro will renew automatically each month' : "Automatic renewal is off. Pro stays on until your paid month ends");
    } catch (e) {
      set({ busy: false });
      fail(e);
    }
  };

  // Back from Paystack after paying for Pro (?pro_reference=...): confirm it and show the plan.
  const proChecked = useRef(false);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('pro_reference');
    if (!LIVE || !ref || proChecked.current || !s.token || s.screen !== 'app') return;
    proChecked.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('pro_reference');
    url.searchParams.delete('reference');
    url.searchParams.delete('trxref');
    window.history.replaceState(null, '', url.toString());
    api.confirmPro(s.token, ref)
      .then(r => {
        set({ plan: r, tab: 'plan' });
        flash(r.status === 'paid' ? "You're on Pro. Thank you!" : r.message || "Your payment hasn't gone through yet.");
      })
      .catch(fail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.token, s.screen]);

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

  /** Ship-from address and delivery options. */
  const shipping: Shipping = normalizeShipping(s.shipping);

  /** Saves shipping settings. Returns an error message to show by the form, or '' when saved. */
  const saveShipping = async (next: Shipping): Promise<string> => {
    for (const o of next.options) {
      if (!o.name.trim()) return 'Give each delivery option a name.';
      if (!(o.price >= 0)) return `Enter a price for ${o.name}.`;
      if (o.zone === 'international' && o.continents.length === 0) return `Choose where ${o.name} ships to.`;
    }
    const clean: Shipping = {
      from: next.from && { ...next.from, name: next.from.name.trim(), address: next.from.address.trim(), city: next.from.city.trim(), region: next.from.region.trim(), postal_code: next.from.postal_code.trim(), phone: next.from.phone.trim() },
      options: next.options.map(o => ({ ...o, name: o.name.trim(), days: o.days.trim(), continents: o.zone === 'domestic' ? [] : o.continents })),
    };
    if (!LIVE) {
      set({ shipping: clean });
      flash('Saved. Buyers see these delivery options at checkout');
      return '';
    }
    set({ busy: true });
    try {
      const { seller } = await api.updateMe(s.token, { shipping: clean });
      set({ shipping: seller.shipping, busy: false });
      flash('Saved. Buyers see these delivery options at checkout');
      return '';
    } catch (e) {
      set({ busy: false });
      return e instanceof Error ? e.message : 'Could not save. Please try again.';
    }
  };

  /**
   * Shrinks and uploads a logo or banner photo and puts it in the design (seen after "Publish").
   * Returns an error message to show, or ''.
   */
  /** Shrinks and uploads a photo; returns its address (in the demo, the photo itself). Throws with a readable message. */
  const uploadPhoto = async (kind: ImageKind, file: File): Promise<string> => {
    const img = await prepareImage(file, kind);
    if (!LIVE) return img.dataUrl;
    return (await api.uploadImage(s.token, { kind, mime_type: img.mimeType, data: img.base64 })).url;
  };

  const uploadStoreImage = async (kind: ImageKind, file: File): Promise<string> => {
    try {
      const url = await uploadPhoto(kind, file);
      setDesign(d => (kind === 'logo' ? { ...d, logo: url } : { ...d, banner: { ...d.banner, image: url, style: d.banner.style === 'none' ? 'large' : d.banner.style } }));
      return '';
    } catch (e) {
      return e instanceof Error ? e.message : 'Could not upload the picture. Please try again.';
    }
  };

  return {
    uploadStoreImage, uploadPhoto, setProductImages, editProduct, deleteProduct,
    shipping, saveShipping,
    pickup, savePickup, savePayout,
    s, set, settings, toast, flash, isMobile, framed, country, fmt, fromUsd, slug, shopNameShown, storeUrl,
    products, toggleHelp, advanceOrder, copyLink, shareWhatsApp, startOver,
    design, setDesign, planInfo, refreshPlan, startTrial, requestUpgrade, setAutoRenew, connectDomain, checkDomain, removeDomain, live: LIVE, submitAuth, confirmDevice, resendDeviceCode, finishOnboarding, addProduct, importProducts, setProductCost, publishDesign, logOut, deleteAccount, setListed, retryLoad, submitVerification, disputeAction, setCollections, saveBookings, saveBookingEmail,
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
