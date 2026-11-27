import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, STORE_DOMAIN } from '../api';
import { CATEGORIES, COUNTRIES } from '../data';
import * as persist from '../persist';
import { goToSide } from '../side';
import { Mark } from '../components/Logo';
import { AccountLogin } from '../account/AccountLogin';
import {
  loadShopper, myOrders, saveShopper, shopHome, shopSearch,
  type MarketProduct, type MarketStore, type SearchResult, type Shopper, type ShopHome, type ShopperOrder,
} from '../account/accountApi';
import { designOf, liveStore, Store, type StoreData } from '../storefront/StorePage';
import { formatMoney } from '../storefront/currency';
import '../storefront/storefront.css';
import './shop.css';

type Tab = 'home' | 'search' | 'basket' | 'orders' | 'account';

/** Short names for the category pills on Home. */
const CATEGORY_LOOK: Record<string, { short: string }> = {
  'Fashion & clothing': { short: 'Fashion' },
  'Beauty & hair': { short: 'Beauty' },
  'Food & drinks': { short: 'Food' },
  'Home & decor': { short: 'Home' },
  'Art & crafts': { short: 'Art' },
  'Digital products': { short: 'Digital' },
};

/** Prices in the store's own money (₦45,000; GH₵300). */
function money(amount: number, country: string, currency: string) {
  const c = COUNTRIES.find(x => x.id === country);
  if (c && country !== 'DI') return c.sym + Math.round(amount).toLocaleString();
  return formatMoney(amount, currency.toUpperCase());
}
const place = (country: string) => (country === 'DI' ? 'Diaspora' : COUNTRIES.find(c => c.id === country)?.name ?? '');

// Store names, remembered for the Basket tab (bags are kept per store by the store page).
const NAMES_KEY = 'aquenora-store-names';
function rememberName(handle: string, name: string) {
  try {
    const all = JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}');
    localStorage.setItem(NAMES_KEY, JSON.stringify({ ...all, [handle]: name }));
  } catch {
    /* storage unavailable */
  }
}
function bags(): { handle: string; name: string; count: number }[] {
  try {
    const names = JSON.parse(localStorage.getItem(NAMES_KEY) ?? '{}') as Record<string, string>;
    const out: { handle: string; name: string; count: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? '';
      if (!key.startsWith('aqenora-bag-')) continue;
      const handle = key.slice('aqenora-bag-'.length);
      const bag = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, number>;
      const count = Object.values(bag).reduce((a, n) => a + (Number(n) || 0), 0);
      if (count > 0) out.push({ handle, name: names[handle] ?? handle, count });
    }
    return out;
  } catch {
    return [];
  }
}

/** AQUENORA's shopping side: search across stores, step into each store's own design. */
export function ShopApp() {
  const [tab, setTab] = useState<Tab>('home');
  const [shopper, setShopper] = useState<Shopper | null>(loadShopper);
  const [store, setStore] = useState<{ handle: string; query?: string; back: string } | null>(null);
  const [login, setLogin] = useState<{ seller: boolean; mode: 'login' | 'signup' } | null>(null);
  const [search, setSearch] = useState<{ q: string; category: string }>({ q: '', category: '' });
  const [focusSearch, setFocusSearch] = useState(0);
  const sellerLoggedIn = !!persist.loadLive();

  useEffect(() => { window.scrollTo(0, 0); }, [tab, store, login]);

  const logOut = () => { saveShopper(null); setShopper(null); };
  const openStore = (handle: string, query?: string) =>
    setStore({ handle, query, back: tab === 'search' ? 'Search results' : tab === 'basket' ? 'Basket' : 'Back' });

  if (login) {
    return (
      <AccountLogin
        startSeller={login.seller}
        initialMode={login.mode}
        onBack={() => setLogin(null)}
        onShopper={s => { setShopper(s); setLogin(null); }}
        onSeller={() => goToSide('sell')}
      />
    );
  }
  if (store) return <StoreScreen key={store.handle} handle={store.handle} query={store.query} backLabel={store.back} onBack={() => setStore(null)} />;

  return (
    <div className="shop">
      <main className="shop-main">
        {tab === 'home' && (
          <Home
            onSearch={() => { setTab('search'); setFocusSearch(n => n + 1); }}
            onCategory={c => { setSearch({ q: '', category: c }); setTab('search'); }}
            onStore={h => openStore(h)}
            onSell={() => (sellerLoggedIn ? goToSide('sell') : setLogin({ seller: true, mode: 'signup' }))}
          />
        )}
        {tab === 'search' && <Search value={search} onChange={setSearch} focus={focusSearch} onStore={openStore} />}
        {tab === 'basket' && <Basket onStore={h => openStore(h)} onShop={() => setTab('home')} />}
        {tab === 'orders' && <Orders shopper={shopper} onLogin={() => setLogin({ seller: false, mode: 'login' })} onExpired={logOut} />}
        {tab === 'account' && (
          <Account
            shopper={shopper}
            sellerLoggedIn={sellerLoggedIn}
            onLogin={mode => setLogin({ seller: false, mode })}
            onSell={() => (sellerLoggedIn ? goToSide('sell') : setLogin({ seller: true, mode: 'signup' }))}
            onSellerLogin={() => (sellerLoggedIn ? goToSide('sell') : setLogin({ seller: true, mode: 'login' }))}
            onOrders={() => setTab('orders')}
            onLogOut={logOut}
          />
        )}
      </main>
      <TabBar tab={tab} onTab={setTab} />
    </div>
  );
}

// ---------------- pieces ----------------

function Brand() {
  return (
    <div className="sh-brand">
      <Mark size={26} ringColor="#CFC8DA" style={{ color: '#fff' }} />
      <span>AQUENORA</span>
    </div>
  );
}

function SearchBox({ value, onChange, onSubmit, autoFocus, focusKey, readOnly, onClick }: {
  value?: string; onChange?: (v: string) => void; onSubmit?: () => void; autoFocus?: boolean; focusKey?: number; readOnly?: boolean; onClick?: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusKey) ref.current?.focus(); }, [focusKey]);
  return (
    <form className="sh-search" role="search" onSubmit={e => { e.preventDefault(); ref.current?.blur(); onSubmit?.(); }} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" /><path d="M13 13l5 5" /></svg>
      <input ref={ref} type="search" enterKeyHint="search" placeholder="Search AQUENORA" aria-label="Search AQUENORA" autoFocus={autoFocus}
        value={value ?? ''} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} />
    </form>
  );
}

function StoreLogo({ store, size = 46 }: { store: MarketStore; size?: number }) {
  const d = useMemo(() => designOf(store), [store]);
  const initials = store.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return d.logo ? (
    <span className="sh-logo" style={{ width: size, height: size, background: d.colors.card }}><img src={d.logo} alt="" /></span>
  ) : (
    <span className="sh-logo" style={{ width: size, height: size, background: d.colors.accent, color: d.colors.accent_text }}>{initials}</span>
  );
}

function StoreBanner({ store, height }: { store: MarketStore; height: number }) {
  const d = useMemo(() => designOf(store), [store]);
  const image = d.banner.image;
  return (
    <div className="sh-banner" style={{
      height,
      background: image ? `center / cover no-repeat url("${image}")` : `linear-gradient(120deg, ${d.colors.accent}, ${d.colors.background})`,
    }} />
  );
}

function ProductPhoto({ p, className }: { p: MarketProduct; className: string }) {
  return (
    <div className={className}>
      <img src={p.image} alt={p.title} loading="lazy" />
    </div>
  );
}

// ---------------- Home ----------------

function Home({ onSearch, onCategory, onStore, onSell }: {
  onSearch: () => void; onCategory: (c: string) => void; onStore: (handle: string) => void; onSell: () => void;
}) {
  const [data, setData] = useState<ShopHome | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    shopHome().then(setData, e => setError(e instanceof Error ? e.message : 'Could not load AQUENORA.'));
  }, []);
  useEffect(() => { load(); }, [load]);
  const storeOf = (handle: string) => data?.featured.find(s => s.handle === handle);

  return (
    <>
      <header className="sh-top">
        <Brand />
        <h1 className="sh-hello">Discover African brands,<br /><span>delivered anywhere.</span></h1>
        <SearchBox readOnly onClick={onSearch} />
      </header>
      <div className="sh-body">
        <nav className="sh-cats" aria-label="Shop by category">
          <button type="button" className="sh-cat on" aria-current="true">All</button>
          {CATEGORIES.map(c => (
            <button type="button" key={c} className="sh-cat" onClick={() => onCategory(c)}>
              {CATEGORY_LOOK[c]?.short ?? c}
            </button>
          ))}
        </nav>

        {error && <Problem message={error} onRetry={load} />}
        {!data && !error && <p className="sh-loading" role="status">Loading…</p>}

        {data && data.featured.length > 0 && (
          <>
            <h2 className="sh-h">Featured stores</h2>
            <div className="sh-stores">
              {data.featured.map(s => (
                <button type="button" key={s.handle} className="sh-scard" onClick={() => onStore(s.handle)}>
                  <StoreBanner store={s} height={84} />
                  <span className="sh-scard-meta">
                    <StoreLogo store={s} />
                    <span className="sh-t"><b>{s.name} <span className="sh-tick" title="Verified seller" aria-label="Verified seller">✓</span></b><small>{CATEGORY_LOOK[s.category]?.short ?? s.category} · {place(s.country_code)}</small></span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {data && data.trending.length > 0 && (
          <>
            <h2 className="sh-h">New on AQUENORA</h2>
            <div className="sh-grid">
              {data.trending.map(p => {
                const s = storeOf(p.store.handle);
                return (
                  <button type="button" key={p.id} className="sh-p" onClick={() => onStore(p.store.handle)}>
                    <ProductPhoto p={p} className="sh-p-img" />
                    <span className="sh-p-t">
                      <b>{p.title}</b>
                      <span>{money(p.price, s?.country_code ?? '', p.currency_code)}</span>
                      <small>{p.store.name}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {data && data.featured.length === 0 && (
          <div className="sh-empty">
            <b>Stores are joining AQUENORA</b>
            <p>Soon you’ll find African brands here to shop from, with delivery at home and abroad.</p>
          </div>
        )}

        <SellCard onSell={onSell} />
      </div>
    </>
  );
}

function SellCard({ onSell, cta = 'Start selling →' }: { onSell: () => void; cta?: string }) {
  return (
    <div className="sh-sell">
      <svg className="sh-sell-ring" viewBox="0 0 512 512" aria-hidden="true"><g transform="rotate(-12 256 320)"><ellipse cx="256" cy="320" rx="196" ry="50" fill="none" stroke="#CFC8DA" strokeWidth="14" /></g></svg>
      <div className="sh-eyebrow">SELL ON AQUENORA</div>
      <h3>Open your own store</h3>
      <p>Free to start. Get paid straight to your bank, and sell to buyers across Africa and abroad.</p>
      <button type="button" onClick={onSell}>{cta}</button>
    </div>
  );
}

function Problem({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="sh-problem" role="alert">
      <p>{message}</p>
      <button type="button" onClick={onRetry}>Try again</button>
    </div>
  );
}

// ---------------- Search ----------------

function Search({ value, onChange, focus, onStore }: {
  value: { q: string; category: string };
  onChange: (v: { q: string; category: string }) => void;
  focus: number;
  onStore: (handle: string, query?: string) => void;
}) {
  const [typed, setTyped] = useState(value.q);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback((q: string, category: string) => {
    if (!q.trim() && !category) { setResult(null); return; }
    setBusy(true);
    setError('');
    shopSearch(q.trim(), category || undefined)
      .then(r => { setResult(r); setBusy(false); })
      .catch(e => { setError(e instanceof Error ? e.message : 'Search failed.'); setBusy(false); });
  }, []);

  // Search as the shopper types (after a short pause), and when the category changes.
  useEffect(() => {
    const t = window.setTimeout(() => run(value.q, value.category), value.q ? 350 : 0);
    return () => window.clearTimeout(t);
  }, [value.q, value.category, run]);

  return (
    <>
      <header className="sh-top sh-top-search">
        <SearchBox value={typed} autoFocus={!value.category && !value.q} focusKey={focus}
          onChange={v => { setTyped(v); onChange({ ...value, q: v }); }}
          onSubmit={() => run(typed, value.category)} />
        <div className="sh-chips" role="group" aria-label="Category">
          <button type="button" aria-pressed={!value.category} className={!value.category ? 'on' : ''} onClick={() => onChange({ ...value, category: '' })}>All</button>
          {CATEGORIES.map(c => (
            <button type="button" key={c} aria-pressed={value.category === c} className={value.category === c ? 'on' : ''} onClick={() => onChange({ ...value, category: value.category === c ? '' : c })}>
              {CATEGORY_LOOK[c]?.short ?? c}
            </button>
          ))}
        </div>
      </header>
      <div className="sh-body">
        {error && <Problem message={error} onRetry={() => run(value.q, value.category)} />}
        {!result && !busy && !error && <p className="sh-hint">Search for anything: “adire”, “shea butter”, “kente”…</p>}
        {busy && !result && <p className="sh-loading" role="status">Searching…</p>}
        {result && (
          <>
            <p className="sh-count" role="status">
              {result.total_products
                ? `${result.total_products} ${result.total_products === 1 ? 'result' : 'results'} in ${result.stores.length} ${result.stores.length === 1 ? 'store' : 'stores'}`
                : `No results${result.query ? ` for “${result.query}”` : ''} yet. Try another word.`}
            </p>
            {result.stores.map(s => (
              <section key={s.handle} className="sh-res">
                <button type="button" className="sh-res-head" onClick={() => onStore(s.handle, result.query)}>
                  <StoreBanner store={s} height={62} />
                  <span className="sh-res-meta">
                    <StoreLogo store={s} />
                    <span className="sh-t"><b>{s.name} <span className="sh-tick" title="Verified seller" aria-label="Verified seller">✓</span></b><small>{place(s.country_code)}{s.sells_abroad ? ' · Ships abroad' : ''}</small></span>
                    <span className="sh-visit">Visit store ›</span>
                  </span>
                </button>
                <div className="sh-row">
                  {s.matches.map(p => (
                    <button type="button" key={p.id} className="sh-mini" onClick={() => onStore(s.handle, result.query)}>
                      <ProductPhoto p={p} className="sh-mini-img" />
                      <b>{p.title}</b>
                      <span>{money(p.price, s.country_code, p.currency_code)}</span>
                    </button>
                  ))}
                </div>
                {s.match_count > s.matches.length && (
                  <button type="button" className="sh-more" onClick={() => onStore(s.handle, result.query)}>
                    + {s.match_count - s.matches.length} more {result.query ? `“${result.query}” items` : 'items'} in this store
                  </button>
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}

// ---------------- A store, opened from the shop ----------------

function StoreScreen({ handle, query, backLabel, onBack }: { handle: string; query?: string; backLabel: string; onBack: () => void }) {
  const [data, setData] = useState<StoreData | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setError('');
    liveStore(handle).then(d => { setData(d); rememberName(d.handle, d.name); }, e =>
      setError(e instanceof ApiError && e.status === 404 ? 'This store isn’t on AQUENORA any more.' : e instanceof Error ? e.message : 'Could not open the store.'));
  }, [handle]);
  useEffect(() => { load(); }, [load]);
  // Paystack returns the buyer to the store's own website, which confirms the order.
  const returnUrl = STORE_DOMAIN ? `https://${handle}.${STORE_DOMAIN}/` : new URL('store.html', window.location.href).href;

  if (!data) {
    return (
      <div className="shop sh-store-wait">
        <button type="button" className="sh-backlink" onClick={onBack}>‹ {backLabel}</button>
        {error ? <Problem message={error} onRetry={load} /> : <p className="sh-loading" role="status">Opening the store…</p>}
      </div>
    );
  }
  return <Store data={data} embedded={{ onBack, backLabel, query, returnUrl }} />;
}

// ---------------- Basket ----------------

function Basket({ onStore, onShop }: { onStore: (handle: string) => void; onShop: () => void }) {
  const list = useMemo(() => bags(), []);
  return (
    <>
      <PageTitle>Basket</PageTitle>
      <div className="sh-body">
        {list.length === 0 ? (
          <div className="sh-empty">
            <b>Your basket is empty</b>
            <p>Add things from any store and they’ll wait for you here.</p>
            <button type="button" className="sh-btn" onClick={onShop}>Start shopping</button>
          </div>
        ) : (
          <>
            <p className="sh-hint">Each store has its own basket and checkout, so you pay each seller directly.</p>
            <div className="sh-list">
              {list.map(b => (
                <button type="button" key={b.handle} className="sh-li" onClick={() => onStore(b.handle)}>
                  <span><b>{b.name}</b><small>{b.count} {b.count === 1 ? 'item' : 'items'} in your bag</small></span>
                  <span className="sh-li-go">Check out ›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------------- Orders ----------------

const STATUS: Record<string, string> = {
  new: 'Paid · being prepared', shipped: 'Shipped', delivered: 'Delivered', ready: 'Ready for pickup', collected: 'Collected', canceled: 'Cancelled',
};

function Orders({ shopper, onLogin, onExpired }: { shopper: Shopper | null; onLogin: () => void; onExpired: () => void }) {
  const [orders, setOrders] = useState<ShopperOrder[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (!shopper) return;
    setError('');
    myOrders(shopper.token).then(r => setOrders(r.orders), e => {
      if (e instanceof ApiError && e.status === 401) onExpired();
      else setError(e instanceof Error ? e.message : 'Could not load your orders.');
    });
  }, [shopper, onExpired]);
  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageTitle>Orders</PageTitle>
      <div className="sh-body">
        {!shopper ? (
          <div className="sh-empty">
            <b>See all your orders in one place</b>
            <p>Log in with the email you use at checkout to see orders from every AQUENORA store.</p>
            <button type="button" className="sh-btn" onClick={onLogin}>Log in</button>
          </div>
        ) : error ? (
          <Problem message={error} onRetry={load} />
        ) : !orders ? (
          <p className="sh-loading" role="status">Loading your orders…</p>
        ) : orders.length === 0 ? (
          <div className="sh-empty"><b>No orders yet</b><p>Orders you pay for with {shopper.email} will show here.</p></div>
        ) : (
          <div className="sh-orders">
            {orders.map(o => (
              <article key={o.id} className="sh-order">
                <header>
                  <b>{o.store?.name ?? 'AQUENORA store'}</b>
                  <span className={'sh-status sh-status-' + o.status}>{STATUS[o.status] ?? o.status}</span>
                </header>
                <small>Order #{o.display_id} · {new Date(o.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</small>
                <ul>{o.items.map((i, n) => <li key={n}>{i.title}{i.quantity > 1 ? ` ×${i.quantity}` : ''}</li>)}</ul>
                <div className="sh-order-total">{formatMoney(o.total, o.currency_code.toUpperCase())}</div>
              </article>
            ))}
          </div>
        )}
        <p className="sh-help">Questions about an order? Email <a href="mailto:orders@aquenora.com?subject=Question%20about%20my%20order">orders@aquenora.com</a> with your order number.</p>
      </div>
    </>
  );
}

// ---------------- Account ----------------

function Account({ shopper, sellerLoggedIn, onLogin, onSell, onSellerLogin, onOrders, onLogOut }: {
  shopper: Shopper | null; sellerLoggedIn: boolean;
  onLogin: (mode: 'login' | 'signup') => void; onSell: () => void; onSellerLogin: () => void; onOrders: () => void; onLogOut: () => void;
}) {
  const site = STORE_DOMAIN ? `https://app.${STORE_DOMAIN}` : '';
  return (
    <>
      <div className="sh-acct">
        {shopper ? (
          <div className="sh-who">
            <span className="sh-av" aria-hidden="true">{(shopper.name || shopper.email)[0]?.toUpperCase()}</span>
            <span><b>{shopper.name || 'Your account'}</b><small>{shopper.email}</small></span>
          </div>
        ) : (
          <div className="sh-guest">
            <b>Your AQUENORA account</b>
            <p>Log in to see your orders from every store.</p>
            <div className="sh-guest-btns">
              <button type="button" className="sh-btn" onClick={() => onLogin('login')}>Log in</button>
              <button type="button" className="sh-btn sh-btn-light" onClick={() => onLogin('signup')}>Create account</button>
            </div>
          </div>
        )}
        <SellCard onSell={onSell} cta={sellerLoggedIn ? 'Go to my store →' : 'Start selling →'} />
        <div className="sh-list">
          <button type="button" className="sh-li" onClick={onOrders}>My orders <span>›</span></button>
          <a className="sh-li" href={`${site}/support`} target="_blank" rel="noopener">Help &amp; support <span>›</span></a>
          <a className="sh-li" href={`${site}/help`} target="_blank" rel="noopener">Help centre <span>›</span></a>
          <a className="sh-li" href={`${site}/privacy`} target="_blank" rel="noopener">Privacy policy <span>›</span></a>
        </div>
        <div className="sh-list">
          <button type="button" className="sh-li" onClick={onSellerLogin}>Already a seller? Go to my store dashboard <span>›</span></button>
        </div>
        {shopper && <button type="button" className="sh-logout" onClick={onLogOut}>Log out</button>}
      </div>
    </>
  );
}

function PageTitle({ children }: { children: ReactNode }) {
  return <header className="sh-top sh-top-plain"><h1 className="sh-title">{children}</h1></header>;
}

// ---------------- tab bar ----------------

const TABS: { key: Tab; label: string; icon: ReactNode }[] = [
  { key: 'home', label: 'Home', icon: <path d="M3 11l9-7 9 7v9H3z" /> },
  { key: 'search', label: 'Search', icon: <><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /></> },
  { key: 'basket', label: 'Basket', icon: <><path d="M3 5h2l2 11h11l2-8H6" /><circle cx="9" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></> },
  { key: 'orders', label: 'Orders', icon: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M8 9h8M8 13h8" /></> },
  { key: 'account', label: 'Account', icon: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 5-6 8-6s7 2 8 6" /></> },
];

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="sh-tabbar" aria-label="Shop">
      {TABS.map(t => (
        <button type="button" key={t.key} aria-current={tab === t.key ? 'page' : undefined} className={tab === t.key ? 'on' : ''} onClick={() => onTab(t.key)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{t.icon}</svg>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

