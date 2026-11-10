import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchHandleForDomain, fetchPublicStore, LIVE, RESERVED_SUBDOMAINS, STORE_DOMAIN } from '../api';
import { COUNTRIES } from '../data';
import * as persist from '../persist';
import { ACCENT_KEYS, demoProducts, initialState, usdConverter } from '../state';
import { designFromLegacy, normalizeDesign, STORE_FONTS, type StoreDesign } from '../design';
import type { CountryId } from '../data';
import { StoreView, type StoreItem } from './StoreView';
import { TAGLINE } from '../brand';
import { DAY_NAMES, DAYS, hoursText, isOpenNow, normalizePickup, shopNow, type Pickup } from '../pickup';

interface StoreData {
  handle: string;
  name: string;
  country: CountryId;
  design: StoreDesign;
  items: StoreItem[];
  sellsAbroad: boolean;
  /** "Powered by AQENORA" shows unless the seller pays for Pro. */
  showBadge: boolean;
  /** In-store pickup, when the seller offers it. */
  pickup: Pickup | null;
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

/** True for a hostname that isn't AQENORA's own (or a dev/hosting address), i.e. a seller's domain. */
function isOwnDomain(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || /^[\d.]+$/.test(h) || h.endsWith('.github.io') || h.endsWith('.up.railway.app')) return false;
  return !(STORE_DOMAIN && (h === STORE_DOMAIN || h.endsWith('.' + STORE_DOMAIN)));
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
  };
}

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
      <div className="wordmark">AQENORA</div>
      {load.kind === 'loading' && <p role="status">Opening the store…</p>}
      {load.kind === 'missing' && (
        <>
          <h1>{load.handle ? `There's no store at ${load.handle}.${STORE_DOMAIN || 'aqenora.com'}` : 'Which store are you looking for?'}</h1>
          <p>Check the link the seller sent you. Store links look like adirehouse.aqenora.com.</p>
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
  const fmt = (n: number) => country.sym + Math.round(Number(n) || 0).toLocaleString();
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

  useEffect(() => saveBag(data.handle, bag), [data.handle, bag]);
  useEffect(() => {
    document.title = data.name;
    document.body.style.background = d.colors.background;
  }, [data.name, d.colors.background]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
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

  return (
    <div className="sp" style={{ color: ink, fontFamily: STORE_FONTS[d.fonts.body].family }}>
      <StoreView
        variant="page"
        name={data.name}
        design={d}
        narrow={width < 600}
        items={data.items}
        fmt={fmt}
        bagCount={count}
        onAdd={add}
        onOpenBag={() => setOpen(true)}
      />

      {data.pickup && <ShopVisit pickup={data.pickup} country={data.country} ink={ink} card={d.colors.card} />}

      <footer className="sp-foot">
        <span>Prices in {country.curName}</span>
        {data.sellsAbroad && <span>Ships worldwide</span>}
        {data.pickup && <span>Pickup available in {data.pickup.area}</span>}
        {data.showBadge && (
          <a className="sp-badge" href="https://aqenora.com" target="_blank" rel="noopener noreferrer" title={`AQENORA: ${TAGLINE}`} style={{ color: ink }}>
            Powered by <b>AQENORA</b>
          </a>
        )}
      </footer>

      {note && <div className="toast" role="status">{note}</div>}

      {open && (
        <div className="sp-overlay" onClick={() => setOpen(false)}>
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
              <button type="button" className="sp-close" style={{ color: ink }} onClick={() => setOpen(false)} aria-label="Close bag">×</button>
            </div>
            {lines.length === 0 ? (
              <p className="sp-bag-empty">Your bag is empty.</p>
            ) : (
              <ul className="sp-lines">
                {lines.map(({ item, qty }) => (
                  <li key={item.key}>
                    <div className="sp-line-name">
                      <span>{item.name}</span>
                      <span>{fmt(item.price * qty)}</span>
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
              <span>{fmt(subtotal)}</span>
            </div>
            {fulfillment === 'pickup' && lines.length > 0 && (
              <div className="sp-total sp-total-sub">
                <span>Pickup</span>
                <span>Free</span>
              </div>
            )}
            <button type="button" className="sp-checkout" disabled style={{ background: d.colors.accent, color: d.colors.accent_text }}>
              Checkout
            </button>
            <p className="sp-soon">
              {fulfillment === 'pickup'
                ? "Paying online is coming soon. Pay now, then collect your order from the shop during opening hours."
                : 'Paying online is coming soon. Delivery costs are added at checkout.'}
            </p>
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
