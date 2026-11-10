import { NAV, type Tab } from '../data';
import { useStore } from '../store';
import { Home } from './Home';
import { Orders } from './Orders';
import { Products } from './Products';
import { ThemeEditor } from './ThemeEditor';
import { Money } from './Money';
import { Customers } from './Customers';
import { Plan } from './Plan';

export function Dashboard() {
  const { s, set, isMobile, shopNameShown, slug } = useStore();
  const newCount = s.orders.filter(o => o.status === 'new').length;
  const pick = (k: Tab) => set({ tab: k, ...(k === 'design' ? { designed: true } : {}) });

  return (
    <div className="app">
      {!isMobile && (
        <aside className="sidebar">
          <div className="wordmark">AQENORA</div>
          <div className="sb-shop">
            <div>{shopNameShown}</div>
            <div>{slug}.aqenora.com</div>
          </div>
          <nav className="sb-nav" aria-label="Main">
            {NAV.map(n => {
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
              <div>{slug}.aqenora.com</div>
            </div>
            <div className="wordmark">AQENORA</div>
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
          {s.tab === 'plan' && <Plan />}
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
