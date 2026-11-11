import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, isOwnDomain, fetchHandleForDomain, fetchPublicStore, LIVE, RESERVED_SUBDOMAINS, startCheckout, STORE_DOMAIN, verifyPayment, type PaymentResult } from '../api';
import { COUNTRIES } from '../data';
import * as persist from '../persist';
import { ACCENT_KEYS, demoProducts, initialState, usdConverter } from '../state';
import { designFromLegacy, normalizeDesign, STORE_FONTS, type StoreDesign } from '../design';
import type { CountryId } from '../data';
import { StoreView, type StoreItem } from './StoreView';
import { TAGLINE } from '../brand';
import { DAY_NAMES, DAYS, hoursText, isOpenNow, normalizePickup, shopNow, type Pickup } from '../pickup';
import { homeCountry, normalizeShipping, optionsFor, type Shipping } from '../shipping';
import { WORLD, WORLD_BY_CODE } from '../countries';
import { convert, currencyChoices, formatMoney, guessBuyerCountry, loadCurrency, saveCurrency, sellerCurrency, useRates } from './currency';

interface StoreData {
  handle: string;
  name: string;
  country: CountryId;
  design: StoreDesign;
  items: StoreItem[];
  sellsAbroad: boolean;
  /** "Powered by AQUENORA" shows unless the seller pays for Pro. */
  showBadge: boolean;
  /** In-store pickup, when the seller offers it. */
  pickup: Pickup | null;
  /** The Checkout button works: Paystack is on and the seller has connected a bank account. */
  acceptsPayments: boolean;
  /** Delivery options (DHL, local courier...) and the country the shop ships from. */
  shipping: Shipping;
  shipsFrom: string | null;
}

type Load =
  | { kind: 'loading' }
  | { kind: 'ready'; data: StoreData }
  | { kind: 'missing'; handle: string }
  | { kind: 'error'; message: string };

/**
 * Which store to show: ?shop=<handle>, or the subdomain on <handle>.<VITE_STORE_DOMAIN>.
 */
function shopHandle(loc: Location = window.location): string {
  const fromQuery = new URLSearchParams(loc.search).get('shop');
  if (fromQuery) return fromQuery.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const host = loc.hostname.toLowerCase();
  if (!STORE_DOMAIN || !host.endsWith('.' + STORE_DOMAIN)) return '';
  const sub = host.slice(0, -(STORE_DOMAIN.length + 1));
  return /^[a-z0-9-]+$/.test(sub) && !RESERVED_SUBDOMAINS.includes(sub) ? sub : '';
}

/** Demo mode: the store from the demo seller app saved in this same browser. */
function demoStore(): StoreData {
  const s = persist.load(
    initialState({ startScreen: 'onboarding', screenFromUrl: false, device: 'auto', showHelpHints: true, reset: false }),
  );
  const country = COUNTRIES.find(c => c.id === s.country) ?? COUNTRIES[0];
  const name = s.shopName.trim() || 'Your shop';
  return {
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourshop',
    name,
    country: s.country,
    design: normalizeDesign(s.design, designFromLegacy({ theme: s.theme, accent: s.accent, font: s.font, announce: s.announce, country: country.id === 'DI' ? 'Africa' : country.name })),
    items: demoProducts(s, usdConverter(country.rate)).map((p, i) => ({ key: `demo-${i}`, name: p.name, price: p.price, stock: p.stock })),
    sellsAbroad: s.intl,
    showBadge: true,
    pickup: offered(s.pickup),
    acceptsPayments: true,
    shipping: normalizeShipping(s.shipping),
    shipsFrom: homeCountry(s.country, normalizeShipping(s.shipping)),
  };
}

/** Pickup settings if the seller has switched pickup on, else null. */
function offered(raw: unknown): Pickup | null {
  const p = normalizePickup(raw);
  return p.enabled && p.address && p.area ? p : null;
}

function liveCountryName(id: CountryId) {
  const c = COUNTRIES.find(x => x.id === id);
  return !c || c.id === 'DI' ? 'Africa' : c.name;
}

async function liveStore(handle: string): Promise<StoreData> {
  const { store, products } = await fetchPublicStore(handle);
  return {
    handle: store.handle,
    name: store.name,
    country: store.country_code,
    design: normalizeDesign(
      store.design,
      designFromLegacy({
        theme: store.theme,
        accent: Math.max(0, ACCENT_KEYS.indexOf(store.accent)),
        font: store.font,
        announce: store.announcement ?? '',
        country: liveCountryName(store.country_code),
      }),
    ),
    items: products.map(p => ({ key: p.id, name: p.title, price: p.price, stock: p.stock })),
    sellsAbroad: store.sells_abroad,
    showBadge: store.show_badge !== false,
    pickup: offered(store.pickup),
    acceptsPayments: store.accepts_payments === true,
    shipping: normalizeShipping({ from: null, options: store.shipping?.options ?? [] }),
    shipsFrom: store.shipping?.ships_from ?? (store.country_code === 'DI' ? null : store.country_code),
  };
}

const COUNTRY_LIST = [...WORLD].sort((a, b) => a.name.localeCompare(b.name));

// ---- bag, kept per store in this browser ----

type Bag = Record<string, number>;
const bagKey = (handle: string) => `aqenora-bag-${handle}`;

function loadBag(handle: string): Bag {
  try {
    const v = JSON.parse(localStorage.getItem(bagKey(handle)) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export type Fulfillment = 'delivery' | 'pickup';
const fulfillmentKey = (handle: string) => `aqenora-fulfillment-${handle}`;

function loadFulfillment(handle: string): Fulfillment {
  try {
    return localStorage.getItem(fulfillmentKey(handle)) === 'pickup' ? 'pickup' : 'delivery';
  } catch {
    return 'delivery';
  }
}

function saveFulfillment(handle: string, f: Fulfillment) {
  try {
    localStorage.setItem(fulfillmentKey(handle), f);
  } catch {
    /* storage unavailable */
  }
}

function saveBag(handle: string, bag: Bag) {
  try {
    localStorage.setItem(bagKey(handle), JSON.stringify(bag));
  } catch {
    /* storage unavailable */
  }
}

// ---- buyer's details, remembered in this browser for next time ----

export interface Buyer {
  name: string; email: string; phone: string; address: string; city: string; region: string; postalCode: string;
  /** ISO country code, e.g. "CA". */
  country: string;
  optIn: boolean;
}
const BUYER_KEY = 'aqenora-buyer';
const emptyBuyer: Buyer = { name: '', email: '', phone: '', address: '', city: '', region: '', postalCode: '', country: '', optIn: false };

function loadBuyer(): Buyer {
  try {
    const v = JSON.parse(localStorage.getItem(BUYER_KEY) ?? '{}');
    return { ...emptyBuyer, ...Object.fromEntries(Object.entries(v ?? {}).filter(([k, x]) => k in emptyBuyer && typeof x === typeof emptyBuyer[k as keyof Buyer])) };
  } catch {
    return emptyBuyer;
  }
}

function saveBuyer(b: Buyer) {
  try {
    localStorage.setItem(BUYER_KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
}

/** Problems with the buyer's details, by field. */
function checkBuyer(b: Buyer, pickup: boolean): Partial<Record<keyof Buyer, string>> {
  const e: Partial<Record<keyof Buyer, string>> = {};
  if (!b.name.trim()) e.name = 'Enter your name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) e.email = 'Enter a valid email address';
  if (!/^\+?[0-9 ()-]{7,20}$/.test(b.phone.trim())) e.phone = 'Enter a valid phone number';
  if (!pickup && !b.address.trim()) e.address = 'Enter your delivery address';
  if (!pickup && !b.city.trim()) e.city = 'Enter your city or town';
  if (!pickup && !WORLD_BY_CODE.has(b.country)) e.country = 'Choose your country';
  return e;
}

/** What happened to a payment, after Paystack sent the buyer back (?reference=...). */
type Paid =
  | { kind: 'checking' }
  | { kind: 'paid'; orderNo: number | string; total: number; pickup: boolean; items: { title: string; quantity: number }[]; shipping?: { name: string; price: number } | null }
  | { kind: 'pending' | 'failed' | 'error'; message: string; reference: string };

function useWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

/** What to show before any network request: the demo store, "which store?", or a spinner. */
function initialLoad(handle: string): Load {
  if (!LIVE) return { kind: 'ready', data: demoStore() };
  if (!handle) return { kind: 'missing', handle: '' };
  return { kind: 'loading' };
}

export function StorePage() {
  const [handle, setHandle] = useState(() => shopHandle());
  // A seller's own domain (e.g. adirehouse.com): ask the backend which store it opens.
  const [resolving, setResolving] = useState(() => LIVE && !handle && isOwnDomain(window.location.hostname));
  const [load, setLoad] = useState<Load>(() => (resolving ? { kind: 'loading' } : initialLoad(handle)));
  useEffect(() => {
    if (!resolving) return;
    fetchHandleForDomain(window.location.hostname).then(h => {
      if (h) setHandle(h);
      else setLoad({ kind: 'missing', handle: window.location.hostname });
      setResolving(false);
    });
  }, [resolving]);

  const fetchStore = useCallback(() => {
    liveStore(handle)
      .then(data => setLoad({ kind: 'ready', data }))
      .catch(e =>
        setLoad(
          e instanceof ApiError && e.status === 404
            ? { kind: 'missing', handle }
            : { kind: 'error', message: e instanceof Error ? e.message : 'This store could not be loaded.' },
        ),
      );
  }, [handle]);

  // Live mode with a store address: load it once on open.
  useEffect(() => {
    if (LIVE && handle) fetchStore();
  }, [fetchStore, handle]);

  const retry = () => {
    setLoad({ kind: 'loading' });
    fetchStore();
  };

  if (load.kind === 'ready') return <Store data={load.data} />;
  return (
    <div className="sp-msg">
      <div className="wordmark">AQUENORA</div>
      {load.kind === 'loading' && <p role="status">Opening the store…</p>}
      {load.kind === 'missing' && (
        <>
          <h1>{load.handle ? `There's no store at ${load.handle}.${STORE_DOMAIN || 'aquenora.com'}` : 'Which store are you looking for?'}</h1>
          <p>Check the link the seller sent you. Store links look like adirehouse.aquenora.com.</p>
        </>
      )}
      {load.kind === 'error' && (
        <>
          <p>{load.message}</p>
          <button type="button" className="btn-dark sp-retry" onClick={retry}>Try again</button>
        </>
      )}
    </div>
  );
}

function Store({ data }: { data: StoreData }) {
  const width = useWidth();
  const country = COUNTRIES.find(c => c.id === data.country) ?? COUNTRIES[0];
  /** In the seller's currency: what Paystack charges. */
  const fmt = (n: number) => country.sym + Math.round(Number(n) || 0).toLocaleString();
  // Buyers can see prices in their own currency (display only).
  const rates = useRates();
  const homeCur = sellerCurrency(data.country);
  const [cur, setCur] = useState<string>(() => {
    const saved = loadCurrency();
    if (saved) return saved;
    const guess = guessBuyerCountry();
    return (guess && WORLD_BY_CODE.get(guess)?.currency) || homeCur;
  });
  const showCur = cur === homeCur || convert(1, homeCur, cur, rates) != null ? cur : homeCur;
  const foreign = showCur !== homeCur;
  /** Prices as the buyer sees them. */
  const show = (n: number) => (foreign ? formatMoney(convert(Number(n) || 0, homeCur, showCur, rates)!, showCur) : fmt(n));
  const pickCurrency = (code: string) => { setCur(code); saveCurrency(code); };
  const d = data.design;
  const ink = d.colors.text;

  const byKey = useMemo(() => new Map(data.items.map(i => [i.key, i])), [data.items]);
  const [bag, setBag] = useState<Bag>(() => {
    // Drop anything no longer for sale, and cap quantities at what's in stock.
    const saved = loadBag(data.handle);
    const clean: Bag = {};
    for (const [k, q] of Object.entries(saved)) {
      const item = byKey.get(k);
      if (item && item.stock > 0 && Number(q) > 0) clean[k] = Math.min(Number(q), item.stock);
    }
    return clean;
  });
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  // Delivery or pickup, remembered for checkout. Pickup only while the seller offers it.
  const [choice, setChoice] = useState<Fulfillment>(() => (data.pickup ? loadFulfillment(data.handle) : 'delivery'));
  const fulfillment: Fulfillment = data.pickup ? choice : 'delivery';
  useEffect(() => saveFulfillment(data.handle, fulfillment), [data.handle, fulfillment]);

  // Checkout: the bag, then the buyer's details, then Paystack's payment page.
  const [stage, setStage] = useState<'bag' | 'details'>('bag');
  const [buyer, setBuyer] = useState<Buyer>(() => {
    const b = loadBuyer();
    return b.country ? b : { ...b, country: guessBuyerCountry() ?? data.shipsFrom ?? '' };
  });
  const [shipId, setShipId] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [paid, setPaid] = useState<Paid | null>(() => (new URLSearchParams(window.location.search).get('reference') ? { kind: 'checking' } : null));

  // Back from Paystack: ask the shop whether the payment went through.
  const checkPayment = useCallback((reference: string) => {
    verifyPayment(reference)
      .then((r: PaymentResult) => {
        if (r.status === 'paid') {
          setPaid({ kind: 'paid', orderNo: r.order.display_id, total: r.checkout.amount, pickup: r.checkout.fulfillment === 'pickup', items: r.checkout.items, shipping: r.checkout.shipping ?? null });
          setBag({});
          const url = new URL(window.location.href);
          url.searchParams.delete('reference');
          url.searchParams.delete('trxref');
          window.history.replaceState(null, '', url.toString());
        } else {
          setPaid({ kind: r.status, message: r.message, reference });
        }
      })
      .catch(e => setPaid({ kind: 'error', message: e instanceof Error ? e.message : 'Could not check your payment.', reference }));
  }, []);
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (reference && LIVE) checkPayment(reference);
  }, [checkPayment]);

  useEffect(() => saveBag(data.handle, bag), [data.handle, bag]);
  useEffect(() => {
    document.title = data.name;
    document.body.style.background = d.colors.background;
  }, [data.name, d.colors.background]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeBag();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const setQty = (key: string, qty: number) => {
    const item = byKey.get(key);
    if (!item) return;
    setBag(b => {
      const next = { ...b };
      const q = Math.max(0, Math.min(qty, item.stock));
      if (q === 0) delete next[key];
      else next[key] = q;
      return next;
    });
  };

  const add = (item: StoreItem) => {
    const current = bag[item.key] ?? 0;
    if (current >= item.stock) {
      setNote(`Only ${item.stock} left of ${item.name}`);
    } else {
      setQty(item.key, current + 1);
      setNote(`${item.name} added to your bag`);
    }
    window.setTimeout(() => setNote(''), 2200);
  };

  const lines = Object.entries(bag).flatMap(([k, q]) => {
    const item = byKey.get(k);
    return item ? [{ item, qty: q }] : [];
  });
  const count = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.item.price, 0);
  function closeBag() {
    setOpen(false);
    setStage('bag');
  }
  // Delivery options for the buyer's country. No options at all: the shop arranges delivery at home.
  const delivering = fulfillment === 'delivery';
  const abroad = !!buyer.country && buyer.country !== data.shipsFrom;
  const shipOptions = delivering && buyer.country ? optionsFor(data.shipping, data.shipsFrom, buyer.country) : [];
  const arranged = delivering && !abroad && data.shipping.options.length === 0;
  const blocked = delivering && !!buyer.country && (abroad && !data.sellsAbroad ? 'abroad-off' : !arranged && shipOptions.length === 0 ? 'no-option' : '');
  const chosen = shipOptions.find(o => o.id === shipId) ?? (shipOptions.length === 1 ? shipOptions[0] : undefined);
  const shippingPrice = delivering ? chosen?.price ?? 0 : 0;
  const total = subtotal + shippingPrice;
  const countryLabel = WORLD_BY_CODE.get(buyer.country)?.name ?? 'your country';
  const errors = checkBuyer(buyer, fulfillment === 'pickup');
  const editBuyer = (patch: Partial<Buyer>) => {
    setBuyer(b => ({ ...b, ...patch }));
    setPayError('');
  };

  const pay = async () => {
    if (Object.keys(errors).length) {
      setShowErrors(true);
      return;
    }
    if (blocked) return;
    if (delivering && !arranged && !chosen) {
      setShowErrors(true);
      setPayError('Choose a delivery option.');
      return;
    }
    saveBuyer(buyer);
    setPaying(true);
    setPayError('');
    if (!LIVE) {
      // Demo: no real payment. Show what the buyer would see afterwards.
      window.setTimeout(() => {
        setPaid({ kind: 'paid', orderNo: 1044, total, pickup: fulfillment === 'pickup', items: lines.map(l => ({ title: l.item.name, quantity: l.qty })), shipping: chosen ? { name: chosen.name, price: chosen.price } : null });
        setBag({});
        setOpen(false);
        setPaying(false);
      }, 600);
      return;
    }
    try {
      const back = new URL(window.location.href);
      back.search = '';
      back.hash = '';
      const shop = new URLSearchParams(window.location.search).get('shop');
      if (shop) back.searchParams.set('shop', shop);
      const { authorization_url } = await startCheckout(data.handle, {
        email: buyer.email.trim(),
        name: buyer.name.trim(),
        phone: buyer.phone.trim(),
        fulfillment,
        ...(fulfillment === 'delivery'
          ? {
              address: buyer.address.trim(),
              city: buyer.city.trim(),
              region: buyer.region.trim() || undefined,
              postal_code: buyer.postalCode.trim() || undefined,
              country: buyer.country,
              shipping_option_id: chosen?.id,
            }
          : {}),
        ...(foreign ? { display_currency: showCur } : {}),
        marketing_opt_in: buyer.optIn,
        return_url: back.toString(),
        items: lines.map(l => ({ product_id: l.item.key, quantity: l.qty })),
      });
      window.location.assign(authorization_url);
    } catch (e) {
      setPaying(false);
      setPayError(e instanceof Error ? e.message : 'Could not start the payment. Please try again.');
    }
  };
  const fieldError = (k: keyof Buyer) => (showErrors && errors[k] ? errors[k] : '');

  return (
    <div className="sp" style={{ color: ink, fontFamily: STORE_FONTS[d.fonts.body].family }}>
      <StoreView
        variant="page"
        name={data.name}
        design={d}
        narrow={width < 600}
        items={data.items}
        fmt={show}
        bagCount={count}
        onAdd={add}
        onOpenBag={() => setOpen(true)}
      />

      {data.pickup && <ShopVisit pickup={data.pickup} country={data.country} ink={ink} card={d.colors.card} />}

      <footer className="sp-foot">
        <label className="sp-cur">
          <span>Prices in</span>
          <select value={showCur} onChange={e => pickCurrency(e.target.value)} style={{ color: ink, borderColor: ink + '40', background: d.colors.card }}>
            {currencyChoices(rates, homeCur).map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>
        {foreign && <span>About; you pay in {country.curName}</span>}
        {data.sellsAbroad && <span>Ships worldwide</span>}
        {data.pickup && <span>Pickup available in {data.pickup.area}</span>}
        {data.showBadge && (
          <a className="sp-badge" href="https://aquenora.com" target="_blank" rel="noopener noreferrer" title={`AQUENORA: ${TAGLINE}`} style={{ color: ink }}>
            Powered by <b>AQUENORA</b>
          </a>
        )}
      </footer>

      {note && <div className="toast" role="status">{note}</div>}

      {paid && (
        <div className="sp-overlay sp-center">
          <div className="sp-receipt" role="dialog" aria-modal="true" aria-labelledby="sp-receipt-title" style={{ background: d.colors.card, color: ink }}>
            {paid.kind === 'checking' && <p role="status" id="sp-receipt-title">Checking your payment…</p>}
            {paid.kind === 'paid' && (
              <>
                <div className="sp-tick" style={{ background: d.colors.accent, color: d.colors.accent_text }} aria-hidden="true">✓</div>
                <h2 id="sp-receipt-title">Thank you! Order #{paid.orderNo} is paid</h2>
                <ul className="sp-receipt-items">
                  {paid.items.map((i, n) => <li key={n}>{i.title}{i.quantity > 1 ? ` ×${i.quantity}` : ''}</li>)}
                </ul>
                {paid.shipping && <div className="sp-total sp-total-sub"><span>{paid.shipping.name}</span><span>{fmt(paid.shipping.price)}</span></div>}
                <div className="sp-total"><span>Paid</span><span>{fmt(paid.total)}</span></div>
                {paid.pickup && data.pickup ? (
                  <div className="sp-pick">
                    <p className="sp-pick-note"><b>Pick up in store.</b> A receipt from Paystack is in your email.</p>
                    <PickupDetails pickup={data.pickup} country={data.country} />
                  </div>
                ) : (
                  <p className="sp-pick-note">
                    {paid.shipping ? `${data.name} will send your order with ${paid.shipping.name} and share the tracking number.` : `${data.name} will contact you about delivery.`} A receipt from Paystack is in your email.
                  </p>
                )}
                <button type="button" className="sp-checkout" style={{ background: d.colors.accent, color: d.colors.accent_text, opacity: 1 }} onClick={() => setPaid(null)}>
                  Keep shopping
                </button>
              </>
            )}
            {(paid.kind === 'pending' || paid.kind === 'failed' || paid.kind === 'error') && (
              <>
                <h2 id="sp-receipt-title">{paid.kind === 'failed' ? 'Payment not completed' : 'We couldn’t confirm your payment yet'}</h2>
                <p className="sp-pick-note">{paid.message} {paid.kind !== 'failed' ? 'If money left your account, your order will still come through. Check again in a minute.' : 'Your bag is still saved.'}</p>
                {paid.kind !== 'failed' && (
                  <button type="button" className="sp-checkout" style={{ background: d.colors.accent, color: d.colors.accent_text, opacity: 1 }} onClick={() => { setPaid({ kind: 'checking' }); checkPayment(paid.reference); }}>
                    Check again
                  </button>
                )}
                <button type="button" className="sp-back" style={{ color: ink }} onClick={() => setPaid(null)}>Back to the shop</button>
              </>
            )}
          </div>
        </div>
      )}

      {open && (
        <div className="sp-overlay" onClick={closeBag}>
          <aside
            className="sp-bag"
            role="dialog"
            aria-modal="true"
            aria-label="Your bag"
            style={{ background: d.colors.card, color: ink }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sp-bag-head">
              <h2>Your bag</h2>
              <button type="button" className="sp-close" style={{ color: ink }} onClick={closeBag} aria-label="Close bag">×</button>
            </div>
            {lines.length === 0 ? (
              <p className="sp-bag-empty">Your bag is empty.</p>
            ) : (
              <ul className="sp-lines">
                {lines.map(({ item, qty }) => (
                  <li key={item.key}>
                    <div className="sp-line-name">
                      <span>{item.name}</span>
                      <span>{show(item.price * qty)}</span>
                    </div>
                    <div className="sp-qty" style={{ borderColor: ink + '33' }}>
                      <button type="button" style={{ color: ink }} onClick={() => setQty(item.key, qty - 1)} aria-label={`One less ${item.name}`}>−</button>
                      <span aria-live="polite">{qty}</span>
                      <button
                        type="button"
                        style={{ color: ink }}
                        disabled={qty >= item.stock}
                        onClick={() => setQty(item.key, qty + 1)}
                        aria-label={`One more ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {data.pickup && lines.length > 0 && (
              <fieldset className="sp-ful">
                <legend>How do you want to get it?</legend>
                {(['delivery', 'pickup'] as const).map(f => {
                  const on = fulfillment === f;
                  return (
                    <label key={f} className="sp-ful-opt" style={{ borderColor: on ? d.colors.accent : ink + '33' }}>
                      <input type="radio" name="fulfillment" value={f} checked={on} onChange={() => setChoice(f)} style={{ accentColor: d.colors.accent }} />
                      <span>
                        <b>{f === 'delivery' ? 'Delivery' : 'Pick up in store'}</b>
                        <small>{f === 'delivery' ? 'Delivered to your address. Cost added at checkout.' : `Free · ${data.pickup!.area}`}</small>
                      </span>
                    </label>
                  );
                })}
                {fulfillment === 'pickup' && <PickupDetails pickup={data.pickup} country={data.country} />}
              </fieldset>
            )}
            <div className="sp-total">
              <span>Subtotal</span>
              <span>{show(subtotal)}</span>
            </div>
            {stage === 'details' && delivering && chosen && (
              <div className="sp-total sp-total-sub">
                <span>Delivery: {chosen.name}</span>
                <span>{chosen.price ? show(chosen.price) : 'Free'}</span>
              </div>
            )}
            {fulfillment === 'pickup' && lines.length > 0 && (
              <div className="sp-total sp-total-sub">
                <span>Pickup</span>
                <span>Free</span>
              </div>
            )}
            {stage === 'details' && lines.length > 0 && (
              <form className="sp-form" noValidate onSubmit={e => { e.preventDefault(); pay(); }}>
                <h3>Your details</h3>
                <BuyerField label="Full name" value={buyer.name} error={fieldError('name')} autoComplete="name" ink={ink}
                  onChange={v => editBuyer({ name: v })} />
                <BuyerField label="Email" type="email" value={buyer.email} error={fieldError('email')} autoComplete="email" ink={ink}
                  hint="Your receipt is sent here." onChange={v => editBuyer({ email: v })} />
                <BuyerField label="Phone (WhatsApp if you have it)" type="tel" value={buyer.phone} error={fieldError('phone')} autoComplete="tel" ink={ink}
                  onChange={v => editBuyer({ phone: v })} />
                {fulfillment === 'delivery' && (
                  <>
                    <label className="sp-field">
                      <span>Country</span>
                      <select value={buyer.country} autoComplete="country" aria-invalid={!!fieldError('country')}
                        style={{ color: ink, borderColor: fieldError('country') ? 'oklch(0.55 0.18 30)' : ink + '33', background: d.colors.card }}
                        onChange={e => { editBuyer({ country: e.target.value }); setShipId(''); }}>
                        <option value="">Choose…</option>
                        {COUNTRY_LIST.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                      {fieldError('country') && <small className="sp-field-error">{fieldError('country')}</small>}
                    </label>
                    <BuyerField label="Delivery address" value={buyer.address} error={fieldError('address')} autoComplete="street-address" ink={ink}
                      onChange={v => editBuyer({ address: v })} />
                    <BuyerField label="City or town" value={buyer.city} error={fieldError('city')} autoComplete="address-level2" ink={ink}
                      onChange={v => editBuyer({ city: v })} />
                    <div className="sp-two">
                      <BuyerField label="State / province" value={buyer.region} error="" autoComplete="address-level1" ink={ink}
                        onChange={v => editBuyer({ region: v })} />
                      <BuyerField label="Postcode" value={buyer.postalCode} error="" autoComplete="postal-code" ink={ink}
                        onChange={v => editBuyer({ postalCode: v })} />
                    </div>
                    {blocked === 'abroad-off' && <div className="sp-pay-error" role="alert">This shop only delivers within {WORLD_BY_CODE.get(data.shipsFrom ?? '')?.name ?? 'its own country'}.</div>}
                    {blocked === 'no-option' && <div className="sp-pay-error" role="alert">This shop doesn't deliver to {countryLabel} yet. Message the shop to ask.</div>}
                    {shipOptions.length > 0 && (
                      <fieldset className="sp-ful">
                        <legend>Delivery to {countryLabel}</legend>
                        {shipOptions.map(o => {
                          const on = chosen?.id === o.id;
                          return (
                            <label key={o.id} className="sp-ful-opt" style={{ borderColor: on ? d.colors.accent : ink + '33' }}>
                              <input type="radio" name="ship" checked={on} onChange={() => { setShipId(o.id); setPayError(''); }} style={{ accentColor: d.colors.accent }} />
                              <span>
                                <b>{o.name} · {o.price ? show(o.price) : 'Free'}</b>
                                {o.days && <small>{o.days}</small>}
                              </span>
                            </label>
                          );
                        })}
                      </fieldset>
                    )}
                    {arranged && <p className="sp-soon">The shop will contact you to arrange delivery.</p>}
                  </>
                )}
                <label className="sp-optin">
                  <input type="checkbox" checked={buyer.optIn} onChange={e => editBuyer({ optIn: e.target.checked })} style={{ accentColor: d.colors.accent }} />
                  <span>Send me news and offers from {data.name}</span>
                </label>
                {payError && <div className="sp-pay-error" role="alert">{payError}</div>}
                <button type="submit" className="sp-checkout sp-pay" disabled={paying || !!blocked} style={{ background: d.colors.accent, color: d.colors.accent_text }}>
                  {paying ? 'Opening Paystack…' : `Pay ${fmt(total)}`}
                </button>
                <p className="sp-soon">
                  {LIVE ? 'You pay securely on Paystack: card, bank transfer or USSD.' : 'Demo store: no real payment is taken.'}
                  {foreign ? ` You're charged in ${country.curName} (${fmt(total)}, about ${show(total)}); your bank converts it.` : ''}
                </p>
                <button type="button" className="sp-back" style={{ color: ink }} onClick={() => setStage('bag')}>← Back to bag</button>
              </form>
            )}
            {stage === 'bag' && (
              <>
                <button
                  type="button"
                  className="sp-checkout"
                  disabled={!data.acceptsPayments || lines.length === 0}
                  style={{ background: d.colors.accent, color: d.colors.accent_text, opacity: !data.acceptsPayments || lines.length === 0 ? 0.5 : 1 }}
                  onClick={() => { setShowErrors(false); setStage('details'); }}
                >
                  Checkout
                </button>
                <p className="sp-soon">
                  {!data.acceptsPayments
                    ? "This shop isn't taking online payments yet. Message the shop to order."
                    : fulfillment === 'pickup'
                      ? 'Pay now, then collect your order from the shop during opening hours.'
                      : 'The shop arranges delivery with you after you pay.'}
                </p>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/** Today's hours and whether the shop is open right now (shop's own time zone). */
function todayLine(pickup: Pickup, country: CountryId) {
  const { day } = shopNow(country);
  const open = isOpenNow(pickup, country);
  const h = pickup.hours[day];
  return { day, open, text: h ? `Today ${hoursText(h)}` : 'Closed today' };
}

/** Address, today's hours and instructions, shown in the bag when the buyer picks "Pick up in store". */
function PickupDetails({ pickup, country }: { pickup: Pickup; country: CountryId }) {
  const today = todayLine(pickup, country);
  return (
    <div className="sp-pick">
      <div className="sp-pick-addr">{pickup.address}</div>
      <div className="sp-pick-today">
        <span className={today.open ? 'sp-open' : 'sp-shut'}>{today.open ? 'Open now' : 'Closed now'}</span>
        <span>{today.text}</span>
      </div>
      {pickup.instructions && <p className="sp-pick-note">{pickup.instructions}</p>}
      <p className="sp-pick-note">We'll let you know when your order is ready to collect.</p>
    </div>
  );
}

/** "Visit our shop": address and the week's opening hours, with today highlighted. */
function ShopVisit({ pickup, country, ink, card }: { pickup: Pickup; country: CountryId; ink: string; card: string }) {
  const today = todayLine(pickup, country);
  return (
    <section className="sp-visit" style={{ background: card, borderColor: ink + '1f' }} aria-labelledby="sp-visit-title">
      <div className="sp-visit-main">
        <h2 id="sp-visit-title">Pick up from our shop</h2>
        <p>Order online and collect for free in {pickup.area}.</p>
        <div className="sp-pick-addr">{pickup.address}</div>
        <div className="sp-pick-today">
          <span className={today.open ? 'sp-open' : 'sp-shut'}>{today.open ? 'Open now' : 'Closed now'}</span>
        </div>
      </div>
      <dl className="sp-hours">
        {DAYS.map(day => (
          <div key={day} className={day === today.day ? 'sp-today' : undefined}>
            <dt>{DAY_NAMES[day]}</dt>
            <dd>{hoursText(pickup.hours[day])}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BuyerField(props: { label: string; value: string; onChange: (v: string) => void; error: string; ink: string; type?: string; autoComplete?: string; hint?: string }) {
  return (
    <label className="sp-field">
      <span>{props.label}</span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        autoComplete={props.autoComplete}
        aria-invalid={!!props.error}
        maxLength={props.type === 'tel' ? 20 : 200}
        style={{ color: props.ink, borderColor: props.error ? 'oklch(0.55 0.18 30)' : props.ink + '33' }}
        onChange={e => props.onChange(e.target.value)}
      />
      {props.error ? <small className="sp-field-error">{props.error}</small> : props.hint ? <small>{props.hint}</small> : null}
    </label>
  );
}
