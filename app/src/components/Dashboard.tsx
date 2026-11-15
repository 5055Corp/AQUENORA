import { NAV, type Tab } from '../data';
import { useStore } from '../store';
import { TAGLINE } from '../brand';
import { Home } from './Home';
import { Orders } from './Orders';
import { Products } from './Products';
import { ThemeEditor } from './ThemeEditor';
import { Money } from './Money';
import { Customers } from './Customers';
import { Plan } from './Plan';
import { Logo } from './Logo';
import { Settings } from './Settings';
import { SELL_PRO_HERE } from '../native';

export function Dashboard() {
  const { s, set, isMobile, shopNameShown, slug } = useStore();
  const newCount = s.orders.filter(o => o.status === 'new').length;
  const pick = (k: Tab) => set({ tab: k, ...(k === 'design' ? { designed: true } : {}) });

  return (
    <div className="app">
      {!isMobile && (
        <aside className="sidebar">
          <div className="sb-brand">
            <Logo />
            <div className="sb-tagline">{TAGLINE}</div>
          </div>
          <div className="sb-shop">
            <div>{shopNameShown}</div>
            <div>{slug}.aquenora.com</div>
          </div>
          <nav className="sb-nav" aria-label="Main">
            {NAV.filter(n => SELL_PRO_HERE || n.key !== 'plan').map(n => {
              const active = s.tab === n.key;
              return (
                <button
                  type="button"
                  key={n.key}
                  aria-current={active ? 'page' : undefined}
                  style={{ background: active ? 'var(--stripe-a)' : 'transparent', fontWeight: active ? 700 : 500 }}
                  onClick={() => pick(n.key)}
                >
                  <span>{n.label}</span>
                  {n.key === 'orders' && newCount > 0 && <span className="badge">{newCount}</span>}
                </button>
              );
            })}
          </nav>
          <div className="sb-help">
            <strong>Need a hand?</strong>
            <span>Chat with a real person on WhatsApp. We reply in English, French or Pidgin.</span>
          </div>
        </aside>
      )}

      <main className="main">
        {isMobile && (
          <div className="m-top">
            <div className="m-top-shop">
              <div>{shopNameShown}</div>
              <div>{slug}.aquenora.com</div>
            </div>
            <div className="m-top-right">
              <Logo />
              <button
                type="button"
                className="m-gear"
                aria-label="Settings"
                aria-current={s.tab === 'settings' ? 'page' : undefined}
                onClick={() => pick('settings')}
              >
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <div
          className="content"
          style={{
            padding: isMobile ? '20px 16px 28px' : '36px 40px',
            maxWidth: s.tab === 'design' ? 1200 : 860,
          }}
        >
          {s.tab === 'home' && <Home />}
          {s.tab === 'orders' && <Orders />}
          {s.tab === 'products' && <Products />}
          {s.tab === 'money' && <Money />}
          {s.tab === 'customers' && <Customers />}
          {s.tab === 'design' && <ThemeEditor />}
          {s.tab === 'plan' && SELL_PRO_HERE && <Plan />}
          {s.tab === 'settings' && <Settings />}
        </div>

        {isMobile && (
          <nav className="tabbar" aria-label="Main">
            {NAV.filter(n => n.phone !== false).map(n => {
              const active = s.tab === n.key;
              return (
                <button
                  type="button"
                  key={n.key}
                  aria-current={active ? 'page' : undefined}
                  style={{ fontWeight: active ? 700 : 500, color: active ? 'var(--ink)' : 'var(--muted-3)' }}
                  onClick={() => pick(n.key)}
                >
                  <span className="tabbar-mark" style={{ background: active ? 'var(--accent)' : 'transparent' }} />
                  <span>{n.short}</span>
                </button>
              );
            })}
          </nav>
        )}
      </main>
    </div>
  );
}
