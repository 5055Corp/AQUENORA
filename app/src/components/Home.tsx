import { HELP } from '../data';
import { useStore } from '../store';
import { daysLeft, formatPrice } from '../plan';

type Key = 'store' | 'product' | 'pay' | 'design' | 'share' | 'order';

export function Home() {
  const { s, set, flash, products, showHints, toggleHelp, fmt, fromUsd, shopNameShown, storeUrl, isMobile, h1Size, copyLink, shareWhatsApp, startOver, live, logOut, planInfo, startTrial } = useStore();

  const checklist: { k: Key; label: string; done: boolean; action?: string; help?: string }[] = [
    { k: 'store', label: 'Create your store', done: true },
    { k: 'product', label: 'Add your first product', done: products.length > 0 },
    { k: 'pay', label: 'Connect Paystack so you can get paid', done: s.paystack, action: 'Connect', help: HELP.checklistPay },
    { k: 'design', label: 'Choose how your store looks', done: s.designed, action: 'Choose' },
    { k: 'share', label: 'Share your store link on WhatsApp or Instagram', done: s.shared, action: 'Share', help: HELP.checklistShare },
    { k: 'order', label: 'Get your first order', done: s.orders.length > 0 },
  ];
  const doneCount = checklist.filter(x => x.done).length;
  const total = checklist.length;

  const doItem = (k: Key) => {
    if (k === 'pay') { set({ paystack: true }); flash('Paystack connected. You can now get paid'); }
    if (k === 'design') set({ tab: 'design' });
    if (k === 'share') { set({ shared: true }); copyLink(); flash('Link copied. Paste it in your WhatsApp status'); }
  };

  const salesUsd = s.orders.reduce((a, o) => a + o.usd, 0);
  // Live: real sales in the last 7 days, in the seller's own currency (cancelled orders don't count).
  const weekAgo = Date.now() - 7 * 86400000;
  const liveSales = s.orders
    .filter(o => o.status !== 'canceled' && o.created_at && new Date(o.created_at).getTime() >= weekAgo)
    .reduce((a, o) => a + (o.amount ?? 0), 0);
  const stats = [
    { label: 'Sales this week', value: fmt(live ? liveSales : fromUsd(salesUsd)) },
    { label: 'Orders', value: String(s.orders.filter(o => o.status !== 'canceled').length) },
    // Visits aren't tracked yet, so live stores show a dash instead of the demo number.
    { label: 'Store visits', value: live ? '—' : '312' },
  ];

  return (
    <>
      <div className="home-head">
        <h1 className="h1" style={{ fontSize: h1Size }}>Welcome back, {shopNameShown}</h1>
        <p>Here's what to do next. {doneCount === total ? "You're all set." : `${total - doneCount} steps left.`}</p>
      </div>

      {planInfo && planInfo.plan.status !== 'paid' && (
        <section className="plan-banner">
          <div>
            <strong>
              {planInfo.plan.status === 'trial'
                ? `Pro trial: ${daysLeft(planInfo.plan.trial_ends_at)} days left`
                : "You're on the Free plan"}
            </strong>
            <span>
              {planInfo.plan.status === 'trial'
                ? `Upgrade for ${formatPrice(planInfo.price)} a month to keep your charts and own domain, and remove "Powered by AQENORA".`
                : `Get full financial charts, your own domain and a lower ${planInfo.settings.pro_commission_percent}% fee with Pro.`}
            </span>
          </div>
          <div className="share-btns">
            {!planInfo.plan.trial_used && (
              <button type="button" className="btn-dark btn-sm" onClick={() => startTrial()}>Try Pro free</button>
            )}
            <button type="button" className="ob-back btn-sm" onClick={() => set({ tab: 'plan' })}>See plans</button>
          </div>
        </section>
      )}

      <section className="card checklist">
        <div className="cl-head">
          <div>Get to your first sale</div>
          <div>{doneCount} of {total} done</div>
        </div>
        <div className="progress"><div style={{ width: Math.round((doneCount / total) * 100) + '%' }} /></div>
        <div className="cl-items">
          {checklist.map(x => {
            const hasHelp = showHints && !x.done && !!x.help;
            const helpOpen = hasHelp && !!s.help['c' + x.k];
            return (
              <div key={x.k} className="cl-item">
                <div className="cl-row">
                  <div
                    className="cl-dot"
                    aria-hidden
                    style={{ background: x.done ? 'var(--go)' : 'transparent', borderColor: x.done ? 'var(--go)' : 'var(--dash)' }}
                  >
                    {x.done ? '✓' : ''}
                  </div>
                  <div className="cl-text">
                    <span style={{ color: x.done ? 'var(--done)' : 'var(--ink)' }}>
                      {x.label}<span className="sr-only">{x.done ? ' (done)' : ''}</span>
                    </span>
                    {hasHelp && (
                      <button type="button" className="link-btn" aria-expanded={helpOpen} onClick={() => toggleHelp('c' + x.k)}>
                        {helpOpen ? 'Hide explanation' : 'Why this matters'}
                      </button>
                    )}
                  </div>
                  {!x.done && x.action && (
                    <button type="button" className="btn-dark btn-sm" onClick={() => doItem(x.k)}>{x.action}</button>
                  )}
                </div>
                {helpOpen && <div className="help-box cl-help">{x.help}</div>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="stats">
        {stats.map(st => (
          <div key={st.label} className="card stat">
            <div>{st.label}</div>
            <div style={{ fontSize: isMobile ? 19 : 26 }}>{st.value}</div>
          </div>
        ))}
      </div>

      <section className="share">
        <div className="share-title">Your store link</div>
        <div className="share-url">{storeUrl}</div>
        <div className="share-btns">
          <button
            type="button"
            className="share-wa"
            onClick={() => { set({ shared: true }); shareWhatsApp(); flash('Opening WhatsApp with your link…'); }}
          >
            Share on WhatsApp
          </button>
          <button type="button" className="share-copy" onClick={() => { set({ shared: true }); copyLink(); flash('Link copied'); }}>
            Copy link
          </button>
          <a className="share-copy share-view" href={storeUrl} target="_blank" rel="noopener">
            View my store
          </a>
        </div>
      </section>

      {live ? (
        <button type="button" className="ob-skip" onClick={() => logOut()}>
          Log out{s.email ? ` (${s.email})` : ''}
        </button>
      ) : (
        <button
          type="button"
          className="ob-skip"
          onClick={() => { if (window.confirm('Clear this store and start setup again?')) startOver(); }}
        >
          Start over
        </button>
      )}
    </>
  );
}
