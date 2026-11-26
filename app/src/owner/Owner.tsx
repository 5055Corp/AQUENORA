// The AQUENORA owner area inside the app: numbers, things waiting for you, and finding a store.
// Opens when AQUENORA's admin email and password are used on the normal login screen.
import { useCallback, useEffect, useState } from 'react';
import { LIVE } from '../api';
import {
  FULL_ADMIN_URL, ownerApi, ownerSignOut,
  type Money, type Overview, type OwnerDispute, type OwnerReport, type OwnerSeller,
} from './ownerApi';
import { DEMO_DISPUTES, DEMO_OVERVIEW, DEMO_REPORTS, DEMO_SELLERS } from './demo';
import './owner.css';

const money = (m: Money) => {
  const parts = Object.entries(m).filter(([, v]) => v);
  if (!parts.length) return '₦0';
  return parts.map(([c, v]) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: c.toUpperCase(), maximumFractionDigits: 0 }).format(v)).join(' + ');
};
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

type OwnerTab = 'overview' | 'todo' | 'sellers';

/** Full-screen owner area with three tabs and a link to the full admin website. */
export function OwnerArea({ onSignedOut }: { onSignedOut: () => void }) {
  const [tab, setTab] = useState<OwnerTab>('overview');
  const [flash, setFlash] = useState('');
  const say = useCallback((m: string) => { setFlash(m); setTimeout(() => setFlash(''), 2600); }, []);
  return (
    <div className="ow" role="dialog" aria-modal="true" aria-label="AQUENORA owner">
      <header className="ow-top">
        <div className="ow-title"><span className="ow-crown" aria-hidden="true">♛</span> Owner</div>
        <a className="ow-full" href={FULL_ADMIN_URL} target="_blank" rel="noopener">Full admin ↗</a>
      </header>
      <nav className="ow-tabs" role="tablist">
        {([['overview', 'Overview'], ['todo', 'To do'], ['sellers', 'Sellers']] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </nav>
      <main className="ow-body">
        {tab === 'overview' && <OverviewTab onTodo={() => setTab('todo')} />}
        {tab === 'todo' && <TodoTab say={say} />}
        {tab === 'sellers' && <SellersTab say={say} />}
        <button type="button" className="ow-signout" onClick={() => { ownerSignOut(); onSignedOut(); }}>Sign out</button>
      </main>
      {flash && <div className="toast" role="status">{flash}</div>}
    </div>
  );
}

function useLoad<T>(load: () => Promise<T>, demo: T, deps: unknown[]) {
  const [data, setData] = useState<T | null>(LIVE ? null : demo);
  const [error, setError] = useState('');
  const reload = useCallback(() => {
    if (!LIVE) return;
    setError('');
    load().then(setData).catch(e => setError(errText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload, setData };
}

function OverviewTab({ onTodo }: { onTodo: () => void }) {
  const [period, setPeriod] = useState<Overview['period']>('month');
  const { data: o, error } = useLoad(() => ownerApi.overview(period), DEMO_OVERVIEW, [period]);
  const waiting = o ? o.needs_you.verifications + o.needs_you.escalated + o.needs_you.reported_products : 0;
  return (
    <>
      <div className="ow-chips">
        {([['month', 'This month'], ['last', 'Last month'], ['all', 'All time']] as const).map(([k, l]) => (
          <button key={k} type="button" className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}
      {!o ? <p className="ow-muted">Loading…</p> : (
        <>
          {waiting > 0 && (
            <button type="button" className="ow-alert" onClick={onTodo}>
              <b>{waiting} {waiting === 1 ? 'thing needs' : 'things need'} you</b>
              <span>{[o.needs_you.verifications && `${o.needs_you.verifications} to verify`, o.needs_you.escalated && `${o.needs_you.escalated} disputes`, o.needs_you.reported_products && `${o.needs_you.reported_products} reported`].filter(Boolean).join(' · ')}</span>
              <i aria-hidden="true">›</i>
            </button>
          )}
          <div className="ow-grid">
            <Stat label="Sales on AQUENORA" value={money(o.sales)} />
            <Stat label="Your commission" value={money(o.commission)} accent />
            <Stat label="Orders" value={String(o.orders)} sub={o.previous ? `${o.previous.orders} the period before` : undefined} />
            <Stat label="New sellers" value={String(o.sellers.new)} sub={o.sellers.new_previous != null ? `${o.sellers.new_previous} the period before` : undefined} />
          </div>
          <section className="ow-card">
            <h3>Sellers</h3>
            <div className="ow-row-stats">
              <span><b>{o.sellers.total}</b>total</span>
              <span><b>{o.sellers.pro}</b>Pro</span>
              <span><b>{o.sellers.trial}</b>on trial</span>
              <span><b>{o.sellers.suspended}</b>paused</span>
            </div>
          </section>
          <section className="ow-card">
            <h3>Top stores</h3>
            {o.top_stores.length === 0 && <p className="ow-muted">No sales in this period yet.</p>}
            <ol className="ow-top-list">
              {o.top_stores.map(s => (
                <li key={s.id}><span>{s.name}<small>{s.orders} orders</small></span><b>{money(s.sales)}</b></li>
              ))}
            </ol>
          </section>
        </>
      )}
    </>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={'ow-stat' + (accent ? ' accent' : '')}>
      <span>{label}</span>
      <b>{value}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function TodoTab({ say }: { say: (m: string) => void }) {
  const v = useLoad(() => ownerApi.verifications().then(r => r.sellers), DEMO_SELLERS.filter(s => s.verification_status === 'pending'), []);
  const d = useLoad(() => ownerApi.disputes().then(r => r.disputes), DEMO_DISPUTES, []);
  const r = useLoad(() => ownerApi.reports().then(x => x.reports), DEMO_REPORTS, []);
  const none = v.data?.length === 0 && d.data?.length === 0 && r.data?.length === 0;
  return (
    <>
      {none && <div className="ow-empty">✓ Nothing waiting for you. Nice.</div>}
      {!!v.data?.length && <h2 className="ow-h">Sellers to verify</h2>}
      {v.data?.map(s => (
        <VerifyItem key={s.id} s={s} done={msg => { say(msg); v.setData(list => list?.filter(x => x.id !== s.id) ?? null); }} />
      ))}
      {!!d.data?.length && <h2 className="ow-h">Disputes waiting for your decision</h2>}
      {d.data?.map(x => (
        <DisputeItem key={x.id} d={x} done={msg => { say(msg); d.setData(list => list?.filter(y => y.id !== x.id) ?? null); }} />
      ))}
      {!!r.data?.length && <h2 className="ow-h">Reported products</h2>}
      {r.data?.map(x => (
        <ReportItem key={x.report_id} r={x} done={msg => { say(msg); r.setData(list => list?.filter(y => y.report_id !== x.report_id) ?? null); }} />
      ))}
      {[v.error, d.error, r.error].filter(Boolean).map(e => <div key={e} className="form-error">{e}</div>)}
    </>
  );
}

const ID_LABEL: Record<string, string> = { nin: 'NIN', drivers_licence: "Driver's licence", passport: 'Passport', voters_card: "Voter's card", national_id: 'National ID' };

function VerifyItem({ s, done }: { s: OwnerSeller; done: (m: string) => void }) {
  const [docs, setDocs] = useState<{ id: string; kind: string }[] | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const v = s.verification ?? {};
  const act = async (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && !reason.trim()) return setError('Say why, so the seller can fix it.');
    setBusy(true);
    try {
      if (LIVE) await ownerApi.reviewVerification(s.id, decision, reason.trim() || undefined);
      done(decision === 'approve' ? `${s.name} is verified` : `${s.name} was asked to fix it`);
    } catch (e) { setError(errText(e)); setBusy(false); }
  };
  const showDocs = async () => {
    if (!LIVE) return setDocs([{ id: 'a', kind: 'id' }, { id: 'b', kind: 'selfie' }]);
    try { setDocs((await ownerApi.documents(s.id)).documents); } catch (e) { setError(errText(e)); }
  };
  return (
    <article className="ow-card ow-item">
      <div className="ow-item-head"><b>{s.name}</b><span className="ow-tag">{v.type === 'registered' ? 'Business' : 'Individual'}</span></div>
      <div className="ow-muted">{s.handle}.aquenora.com · {s.email}</div>
      <dl className="ow-dl">
        {v.business_name && <><dt>Business</dt><dd>{v.business_name}{v.cac_number ? ` · ${v.cac_number}` : ''}</dd></>}
        {v.id_type && <><dt>ID</dt><dd>{ID_LABEL[v.id_type] ?? v.id_type}</dd></>}
        {v.socials && Object.keys(v.socials).length > 0 && <><dt>Socials</dt><dd>{Object.entries(v.socials).map(([k, h]) => `${k}: @${h}`).join(' · ')}</dd></>}
      </dl>
      {docs ? (
        <div className="ow-docs">{docs.map(x => <button key={x.id} type="button" className="btn-sm pickup-edit" onClick={() => LIVE && ownerApi.openDocument(s.id, x.id).catch(e => setError(errText(e)))}>Open {x.kind === 'cac' ? 'CAC' : x.kind === 'id' ? 'ID' : 'selfie'}</button>)}</div>
      ) : <button type="button" className="link-btn" onClick={showDocs}>See documents</button>}
      {rejecting && <textarea className="field ow-text" rows={2} placeholder="What should they fix? (they're emailed this)" value={reason} onChange={e => { setReason(e.target.value); setError(''); }} />}
      {error && <div className="form-error">{error}</div>}
      <div className="ow-actions">
        {rejecting ? (
          <>
            <button type="button" className="btn-sm pickup-edit" onClick={() => setRejecting(false)} disabled={busy}>Cancel</button>
            <button type="button" className="btn-dark btn-sm ow-danger" onClick={() => act('reject')} disabled={busy}>Send back</button>
          </>
        ) : (
          <>
            <button type="button" className="btn-sm pickup-edit" onClick={() => setRejecting(true)} disabled={busy}>Send back</button>
            <button type="button" className="btn-dark btn-sm ow-go" onClick={() => act('approve')} disabled={busy}>Approve</button>
          </>
        )}
      </div>
    </article>
  );
}

function DisputeItem({ d, done }: { d: OwnerDispute; done: (m: string) => void }) {
  const [text, setText] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const decide = async (outcome: 'refund_required' | 'seller') => {
    if (!text.trim()) return setError('Write your decision. Both the buyer and the shop are emailed it.');
    setBusy(true);
    try {
      if (LIVE) await ownerApi.decide(d.id, outcome, text.trim(), outcome === 'refund_required' && amount ? Number(amount) : undefined);
      done(outcome === 'seller' ? 'Decided for the shop' : 'Shop told to refund');
    } catch (e) { setError(errText(e)); setBusy(false); }
  };
  return (
    <article className="ow-card ow-item">
      <div className="ow-item-head"><b>Order #{d.order_display_id} · {d.reason_label}</b><span className="ow-tag warn">Escalated</span></div>
      <div className="ow-muted">{d.buyer_name} vs {d.seller?.name ?? 'shop'}</div>
      <div className="ow-thread">
        {d.messages.map((m, i) => <p key={i} className={'ow-msg ' + m.from}><b>{m.from === 'buyer' ? 'Buyer' : m.from === 'seller' ? 'Shop' : 'AQUENORA'}:</b> {m.text}</p>)}
      </div>
      <textarea className="field ow-text" rows={2} placeholder="Your decision and why" value={text} onChange={e => { setText(e.target.value); setError(''); }} />
      <input className="field ow-amount" inputMode="numeric" placeholder="Refund amount (if refunding)" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
      {error && <div className="form-error">{error}</div>}
      <div className="ow-actions">
        <button type="button" className="btn-sm pickup-edit" onClick={() => decide('seller')} disabled={busy}>Shop is right</button>
        <button type="button" className="btn-dark btn-sm ow-danger" onClick={() => decide('refund_required')} disabled={busy}>Shop must refund</button>
      </div>
    </article>
  );
}

const REASON_LABEL: Record<string, string> = { counterfeit: 'Fake', prohibited: 'Not allowed', misleading: 'Misleading', offensive: 'Offensive', scam: 'Scam', other: 'Other' };

function ReportItem({ r, done }: { r: OwnerReport; done: (m: string) => void }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (action: 'hide' | 'dismiss') => {
    if (action === 'hide' && !reason.trim()) return setError('Write why (the shop is emailed it).');
    setBusy(true);
    try {
      if (LIVE) await ownerApi.reviewReport(r.report_id, action, reason.trim() || undefined);
      done(action === 'hide' ? 'Product hidden' : 'Report dismissed');
    } catch (e) { setError(errText(e)); setBusy(false); }
  };
  return (
    <article className="ow-card ow-item">
      <div className="ow-report">
        {r.product?.thumbnail ? <img src={r.product.thumbnail} alt="" /> : <div className="ow-thumb" aria-hidden="true" />}
        <div>
          <b>{r.product?.title ?? 'Deleted product'}</b>
          <div className="ow-muted">{r.seller?.name} · reported {r.count}×</div>
          <div className="ow-reasons">{Object.entries(r.reasons).map(([k, n]) => <span key={k} className="ow-tag warn">{REASON_LABEL[k] ?? k}{n > 1 ? ` ×${n}` : ''}</span>)}</div>
        </div>
      </div>
      {r.notes.length > 0 && <div className="ow-thread">{r.notes.slice(0, 3).map((n, i) => <p key={i} className="ow-msg">“{n}”</p>)}</div>}
      <input className="field ow-text" placeholder="Why hide it? (sent to the shop)" value={reason} onChange={e => { setReason(e.target.value); setError(''); }} />
      {error && <div className="form-error">{error}</div>}
      <div className="ow-actions">
        <button type="button" className="btn-sm pickup-edit" onClick={() => act('dismiss')} disabled={busy}>It's fine</button>
        <button type="button" className="btn-dark btn-sm ow-danger" onClick={() => act('hide')} disabled={busy}>Hide product</button>
      </div>
    </article>
  );
}

function SellersTab({ say }: { say: (m: string) => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data, error, setData } = useLoad(() => ownerApi.sellers(query).then(r => r.sellers), DEMO_SELLERS, [query]);
  const shown = LIVE ? data : data?.filter(s => !query || `${s.name} ${s.handle} ${s.email}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <form className="ow-search" onSubmit={e => { e.preventDefault(); setQuery(q.trim()); }}>
        <input className="field" type="search" placeholder="Shop name, web address or email" value={q} onChange={e => setQ(e.target.value)} />
        <button type="submit" className="btn-dark btn-sm">Find</button>
      </form>
      {error && <div className="form-error">{error}</div>}
      {shown?.length === 0 && <p className="ow-muted">No stores found.</p>}
      {shown?.map(s => <SellerItem key={s.id} s={s} say={say} onChange={n => setData(list => list?.map(x => (x.id === s.id ? n : x)) ?? null)} />)}
    </>
  );
}

function SellerItem({ s, say, onChange }: { s: OwnerSeller; say: (m: string) => void; onChange: (s: OwnerSeller) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const paused = !!s.suspended_at;
  const pro = !!s.pro_paid_until && new Date(s.pro_paid_until).getTime() > Date.now();
  const toggle = async () => {
    if (!paused && !reason.trim()) return setError('Write the reason (the seller is emailed it).');
    setBusy(true);
    try {
      if (LIVE) await ownerApi.suspend(s.id, !paused, paused ? undefined : reason.trim());
      onChange({ ...s, suspended_at: paused ? null : new Date().toISOString(), suspend_reason: paused ? null : reason.trim() });
      say(paused ? `${s.name} is open again` : `${s.name} is paused`);
      setOpen(false);
      setReason('');
    } catch (e) { setError(errText(e)); }
    setBusy(false);
  };
  return (
    <article className="ow-card ow-item">
      <button type="button" className="ow-seller" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span>
          <b>{s.name}</b>
          <small>{s.handle}.aquenora.com · {s.country_code}</small>
        </span>
        <span className="ow-tags">
          {paused && <span className="ow-tag warn">Paused</span>}
          {s.verification_status === 'verified' ? <span className="ow-tag ok">Verified</span> : <span className="ow-tag">{s.verification_status}</span>}
          {pro && <span className="ow-tag pro">Pro</span>}
        </span>
      </button>
      {open && (
        <div className="ow-seller-more">
          <div className="ow-muted">{s.email} · joined {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          {paused && s.suspend_reason && <div className="ow-paused">Paused: {s.suspend_reason}</div>}
          <a className="link-btn" href={`https://${s.handle}.aquenora.com`} target="_blank" rel="noopener">Open store ↗</a>
          {!paused && <input className="field ow-text" placeholder="Reason for pausing (emailed to the seller)" value={reason} onChange={e => { setReason(e.target.value); setError(''); }} />}
          {error && <div className="form-error">{error}</div>}
          <button type="button" className={'btn-dark btn-sm ' + (paused ? 'ow-go' : 'ow-danger')} onClick={toggle} disabled={busy}>{paused ? 'Open the store again' : 'Pause this store'}</button>
        </div>
      )}
    </article>
  );
}
