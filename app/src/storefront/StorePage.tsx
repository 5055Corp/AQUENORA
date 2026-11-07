import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, fetchPublicStore, LIVE, RESERVED_SUBDOMAINS, STORE_DOMAIN } from '../api';
import { COUNTRIES } from '../data';
import * as persist from '../persist';
import { ACCENT_KEYS, demoProducts, initialState, usdConverter } from '../state';
import { lookStyle, StoreView, type StoreItem, type StoreLook } from './StoreView';

interface StoreData {
  handle: string;
  look: StoreLook;
  items: StoreItem[];
  sellsAbroad: boolean;
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
    look: { name, theme: s.theme, accent: s.accent, font: s.font, announce: s.announce, country: s.country },
    items: demoProducts(s, usdConverter(country.rate)).map((p, i) => ({ key: `demo-${i}`, name: p.name, price: p.price, stock: p.stock })),
    sellsAbroad: s.intl,
  };
}

async function liveStore(handle: string): Promise<StoreData> {
  const { store, products } = await fetchPublicStore(handle);
  return {
    handle: store.handle,
    look: {
      name: store.name,
      theme: store.theme,
      accent: Math.max(0, ACCENT_KEYS.indexOf(store.accent)),
      font: store.font,
      announce: store.announcement ?? '',
      country: store.country_code,
    },
    items: products.map(p => ({ key: p.id, name: p.title, price: p.price, stock: p.stock })),
    sellsAbroad: store.sells_abroad,
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
  const handle = useMemo(() => shopHandle(), []);
  const [load, setLoad] = useState<Load>(() => initialLoad(handle));

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
  const country = COUNTRIES.find(c => c.id === data.look.country) ?? COUNTRIES[0];
  const fmt = (n: number) => country.sym + Math.round(Number(n) || 0).toLocaleString();
  const { th, accent } = lookStyle(data.look);

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

  useEffect(() => saveBag(data.handle, bag), [data.handle, bag]);
  useEffect(() => {
    document.title = data.look.name;
    document.body.style.background = th.bg;
  }, [data.look.name, th.bg]);
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
  const columns = width < 520 ? 'repeat(2,minmax(0,1fr))' : width < 900 ? 'repeat(3,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))';

  return (
    <div className="sp" style={{ color: th.ink }}>
      <StoreView
        variant="page"
        look={data.look}
        items={data.items}
        fmt={fmt}
        columns={columns}
        bagCount={count}
        onAdd={add}
        onOpenBag={() => setOpen(true)}
      />

      <footer className="sp-foot">
        <span>Prices in {country.curName}</span>
        {data.sellsAbroad && <span>Ships worldwide</span>}
        <span>Store by AQENORA</span>
      </footer>

      {note && <div className="toast" role="status">{note}</div>}

      {open && (
        <div className="sp-overlay" onClick={() => setOpen(false)}>
          <aside
            className="sp-bag"
            role="dialog"
            aria-modal="true"
            aria-label="Your bag"
            style={{ background: th.card, color: th.ink }}
            onClick={e => e.stopPropagation()}
          >
            <div className="sp-bag-head">
              <h2>Your bag</h2>
              <button type="button" className="sp-close" style={{ color: th.ink }} onClick={() => setOpen(false)} aria-label="Close bag">×</button>
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
                    <div className="sp-qty" style={{ borderColor: th.sa }}>
                      <button type="button" style={{ color: th.ink }} onClick={() => setQty(item.key, qty - 1)} aria-label={`One less ${item.name}`}>−</button>
                      <span aria-live="polite">{qty}</span>
                      <button
                        type="button"
                        style={{ color: th.ink }}
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
            <div className="sp-total">
              <span>Subtotal</span>
              <span>{fmt(subtotal)}</span>
            </div>
            <button type="button" className="sp-checkout" disabled style={{ background: accent }}>
              Checkout
            </button>
            <p className="sp-soon">Paying online is coming soon. Delivery costs are added at checkout.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
