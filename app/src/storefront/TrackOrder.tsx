import { useEffect, useState } from 'react';
import { fetchTracking, LIVE, type TrackedOrder } from '../api';
import { STORE_FONTS, type StoreDesign } from '../design';
import { ProblemPanel } from './ProblemPanel';

type Step = { label: string; detail: string };

/** The steps an order goes through, and which one it's on. */
function stepsOf(o: TrackedOrder['order'], shop: string): { steps: Step[]; at: number; headline: string } {
  const made = !!o.made_to_order_days;
  const paidOn = new Date(o.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const ready = made ? new Date(new Date(o.created_at).getTime() + o.made_to_order_days! * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  const first: Step = { label: 'Paid', detail: paidOn };
  const making: Step = made ? { label: 'Being made', detail: `Made to order · ready by about ${ready}` } : { label: o.fulfillment === 'pickup' ? 'Being prepared' : 'Being packed', detail: `${shop} has your order` };
  if (o.fulfillment === 'pickup') {
    const steps = [first, making, { label: 'Ready to pick up', detail: o.pickup_address ?? 'At the shop' }, { label: 'Collected', detail: 'Enjoy!' }];
    const at = o.status === 'collected' ? 3 : o.status === 'ready' ? 2 : 1;
    const headline = ['', made ? 'Your order is being made' : 'Your order is being prepared', 'Ready to pick up', 'Collected. Enjoy!'][at];
    return { steps, at, headline };
  }
  const steps = [first, making, { label: 'On the way', detail: o.shipping ? `${o.shipping.name}${o.shipping.days ? ` · ${o.shipping.days}` : ''}` : `${shop} is arranging delivery` }, { label: 'Delivered', detail: o.place ?? '' }];
  const at = o.status === 'delivered' ? 3 : o.status === 'shipped' ? 2 : 1;
  const headline = ['', made ? 'Your order is being made' : 'Your order is being packed', 'Your order is on the way', 'Delivered. Enjoy!'][at];
  return { steps, at, headline };
}

/** Demo mode: a sample order, so the page can be previewed without a backend. */
const DEMO: TrackedOrder = {
  order: {
    display_id: 1051, created_at: new Date(Date.now() - 86400000).toISOString(), status: 'new', fulfillment: 'delivery', currency_code: 'ngn',
    items: [{ title: 'Bone straight wig (20 inch, Honey blonde)', quantity: 1, unit_price: 65000, note: 'Medium cap, please add baby hairs' }],
    total: 65000, shipping: { name: 'Lagos delivery', price: 0, days: '1-2 days' }, made_to_order_days: 5, place: 'Lekki, Lagos', pickup_address: null,
  },
  store: { name: '', handle: '', whatsapp: '2348012345678' },
  dispute: null,
};

/** "Track my order": opened from the link in the buyer's confirmation email (?track=...). */
export function TrackOrder({ token, design: d, shopName, verified, fmt, onBack }: {
  token: string;
  design: StoreDesign;
  shopName: string;
  verified: boolean;
  fmt: (n: number) => string;
  onBack: () => void;
}) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'ready'; data: TrackedOrder } | { kind: 'error'; message: string }>(() =>
    LIVE ? { kind: 'loading' } : { kind: 'ready', data: DEMO },
  );
  useEffect(() => {
    if (!LIVE) return;
    fetchTracking(token)
      .then(data => setState({ kind: 'ready', data }))
      .catch(e => setState({ kind: 'error', message: e instanceof Error ? e.message : 'Your order could not be loaded.' }));
  }, [token]);
  const c = d.colors;
  const heading = STORE_FONTS[d.fonts.heading].family;

  return (
    <div className="tr" style={{ background: c.background, color: c.text }}>
      <header className="tr-head" style={{ background: c.accent, color: c.accent_text }}>
        <div className="tr-shop" style={{ fontFamily: heading }}>{shopName}</div>
        {verified && <div className="tr-verified">✓ Verified seller</div>}
      </header>
      <main className="tr-main">
        {state.kind === 'loading' && <p role="status">Finding your order…</p>}
        {state.kind === 'error' && <p role="alert">{state.message}</p>}
        {state.kind === 'ready' && (() => {
          const o = state.data.order;
          if (o.status === 'canceled') {
            return (
              <>
                <div className="tr-no">ORDER #{o.display_id}</div>
                <h1 className="tr-h">This order was cancelled</h1>
                <p>If you didn't expect this, contact {shopName}.</p>
              </>
            );
          }
          const { steps, at, headline } = stepsOf(o, shopName);
          const wa = state.data.store.whatsapp;
          return (
            <>
              <div className="tr-no">ORDER #{o.display_id}</div>
              <h1 className="tr-h">{headline}</h1>
              <ol className="tr-steps" style={{ background: c.card }}>
                {steps.map((s, i) => (
                  <li key={s.label} className={i < at || (i === at && at === steps.length - 1) ? 'done' : i === at ? 'now' : 'todo'} aria-current={i === at ? 'step' : undefined}>
                    <span className="tr-dot" style={i === at && at < steps.length - 1 ? { background: c.accent, boxShadow: `0 0 0 6px ${c.accent}33` } : undefined}>{i < at || (i === at && at === steps.length - 1) ? '✓' : ''}</span>
                    <span><b>{s.label}</b><small>{s.detail}</small></span>
                  </li>
                ))}
              </ol>
              <section className="tr-items" style={{ background: c.card }}>
                {o.items.map((it, n) => (
                  <div key={n} className="tr-item">
                    <div><b>{it.title}</b>{it.quantity > 1 ? ` ×${it.quantity}` : ''}</div>
                    {it.note && <small>Your note: {it.note}</small>}
                  </div>
                ))}
                <div className="tr-total"><span>Paid</span><span>{fmt(o.total)}</span></div>
              </section>
              <ProblemPanel token={token} initial={state.data.dispute} shop={shopName} accent={c.accent} accentText={c.accent_text} ink={c.text} card={c.card} money={fmt} />
              {wa && (
                <a className="tr-wa" href={`https://wa.me/${wa}?text=${encodeURIComponent(`Hi ${shopName}, about my order #${o.display_id}`)}`} target="_blank" rel="noreferrer" style={{ color: c.text, borderColor: c.text + '33' }}>
                  Message {shopName} on WhatsApp
                </a>
              )}
            </>
          );
        })()}
        <button type="button" className="tr-back" style={{ color: c.text }} onClick={onBack}>← Back to {shopName}</button>
        <div className="tr-brand">AQUENORA</div>
      </main>
    </div>
  );
}
