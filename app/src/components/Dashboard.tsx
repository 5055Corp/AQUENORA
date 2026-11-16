import type { ReactNode } from 'react';
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

/** Bottom-menu icons on phones (same style as the Shop side's menu). */
const TAB_ICONS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9H3z" />,
  orders: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  products: <><path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z" /><circle cx="7.5" cy="7.5" r="1.4" /></>,
  money: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  customers: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.5-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2" /></>,
  design: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
};

export function Dashboard() {
  const { s, set, isMobile, framed, shopNameShown, slug } = useStore();
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

      <main className={'main' + (isMobile && !framed ? ' main-tabbed' : '')}>
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
          <nav className={'tabbar' + (framed ? '' : ' tabbar-fixed')} aria-label="Main">
            {NAV.filter(n => n.phone !== false).map(n => {
              const active = s.tab === n.key;
              return (
                <button
                  type="button"
                  key={n.key}
                  aria-current={active ? 'page' : undefined}
                  style={{ fontWeight: active ? 700 : 600, color: active ? '#ffffff' : '#9A93A8' }}
                  onClick={() => pick(n.key)}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_ICONS[n.key]}</svg>
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
