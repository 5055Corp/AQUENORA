// Orders tab → Bookings (service providers only): the week, the day's appointments, and adding one by hand.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, type SellerBooking, type Service, type TimeBlock } from '../api';
import { useStore } from '../store';
import { BlockTimeSheet, blocksOnDay } from './BusinessTeam';

const DAY = 86400000;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const mins = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60}` : `${m / 60} hr`);

function demoBookings(): SellerBooking[] {
  const at = (days: number, h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const b = (id: string, days: number, h: number, m: number, name: string, svc: string, dur: number, price: number, paid: number, status: SellerBooking['status'] = 'confirmed'): SellerBooking => ({
    id, service_id: 's', service_name: svc, duration_min: dur, starts_at: at(days, h, m), ends_at: at(days, h, m + dur), status, customer_name: name, email: 'x@example.com', phone: '+234 801 234 5678',
    note: null, currency_code: 'ngn', price, deposit: paid, paid, owed: price - paid, tips: 0, refund_due: 0, refunded_at: null, cancelled_by: null,
  });
  return [
    b('1', 0, 10, 0, 'Chioma Eze', 'Bridal trial makeup', 60, 45000, 45000),
    b('2', 0, 12, 30, 'Funmi Adeyemi', 'Knotless braids', 180, 30000, 9000),
    b('3', 0, 16, 0, 'Amaka Obi', 'Lash refill', 30, 8000, 0),
    b('4', 1, 11, 0, 'Ngozi Okafor', 'Soft glam', 60, 25000, 5000),
    b('5', 2, 9, 30, 'Halima Bello', 'Knotless braids', 180, 30000, 9000),
  ];
}

export function Bookings() {
  const { s, live, fmt, flash } = useStore();
  const [list, setList] = useState<SellerBooking[] | null>(live ? null : demoBookings());
  const [day, setDay] = useState(() => dayKey(new Date()));
  const [open, setOpen] = useState<SellerBooking | null>(null);
  const [adding, setAdding] = useState(false);
  const [blocking, setBlocking] = useState<TimeBlock | 'new' | null>(null);
  const team = (s.bookings?.staff ?? []).filter(m => m.active);
  const [who, setWho] = useState('');

  const load = useCallback(() => {
    if (!live) return;
    api.bookings(s.token).then(r => setList(r.bookings)).catch(e => flash(e instanceof Error ? e.message : 'Could not load bookings.'));
  }, [live, s.token, flash]);
  useEffect(load, [load]);

  const week = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(Date.now() + i * DAY)), []);
  const live7 = (list ?? []).filter(b => b.status !== 'cancelled');
  const onDay = (list ?? []).filter(b => dayKey(new Date(b.starts_at)) === day && (!who || b.staff_id === who)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  // Breaks and time off on this day, in time order with the bookings.
  const blocks = blocksOnDay(s.bookings, day, who || null);
  const rows: { at: string; block?: TimeBlock; booking?: SellerBooking }[] = [
    ...blocks.map(b => ({ at: b.all_day ? '00:00' : b.from, block: b })),
    ...onDay.map(b => ({ at: time(b.starts_at), booking: b })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const staffName = (id?: string | null) => team.find(m => m.id === id)?.name;
  const refunds = (list ?? []).filter(b => b.refund_due > 0 && !b.refunded_at);

  const act = async (b: SellerBooking, action: 'complete' | 'no_show' | 'refunded' | 'cancel') => {
    let reason: string | undefined;
    if (action === 'cancel') {
      const r = window.prompt(`Cancel ${b.customer_name}'s booking? Tell them why (optional):`);
      if (r === null) return;
      reason = r.trim() || undefined;
    }
    try {
      const next = live ? (await api.bookingAction(s.token, b.id, { action, reason })).booking
        : { ...b, status: action === 'complete' ? 'completed' : action === 'no_show' ? 'no_show' : action === 'cancel' ? 'cancelled' : b.status, refunded_at: action === 'refunded' ? new Date().toISOString() : b.refunded_at, refund_due: action === 'cancel' ? b.paid : b.refund_due } as SellerBooking;
      setList(l => (l ?? []).map(x => (x.id === b.id ? next : x)));
      setOpen(null);
      flash(action === 'complete' ? 'Marked as done' : action === 'no_show' ? "Marked as didn't come. You keep the deposit." : action === 'refunded' ? 'Marked as refunded' : 'Booking cancelled. The customer has been told.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not change it.');
    }
  };

  return (
    <div className="bk">
      <div className="bk-stats">
        <div><span>Today</span><b>{live7.filter(b => dayKey(new Date(b.starts_at)) === dayKey(new Date())).length}</b></div>
        <div><span>Next 7 days</span><b>{live7.filter(b => { const t = new Date(b.starts_at).getTime(); return t >= Date.now() - DAY && t < Date.now() + 7 * DAY; }).length}</b></div>
        <div><span>Paid online</span><b>{fmt(live7.reduce((a, b) => a + b.paid, 0))}</b></div>
      </div>

      {refunds.length > 0 && (
        <div className="bk-alert" role="status">
          <b>{refunds.length === 1 ? '1 refund to make' : `${refunds.length} refunds to make`}</b>
          {refunds.map(b => (
            <div key={b.id}><span>{b.customer_name} · {fmt(b.refund_due)}</span><button type="button" className="link-btn" onClick={() => act(b, 'refunded')}>Mark as refunded</button></div>
          ))}
        </div>
      )}

      <div className="bk-week" role="tablist" aria-label="Day">
        {week.map(d => {
          const k = dayKey(d);
          const has = live7.some(b => dayKey(new Date(b.starts_at)) === k);
          return (
            <button type="button" role="tab" key={k} aria-selected={day === k} className={'bk-day' + (day === k ? ' on' : '')} onClick={() => setDay(k)}>
              {d.toLocaleDateString('en-GB', { weekday: 'short' })}<b>{d.getDate()}</b>{has ? <i /> : <i className="none" />}
            </button>
          );
        })}
      </div>

      {team.length > 0 && (
        <div className="bk-staff-chips biz-chips" role="group" aria-label="Team member">
          <button type="button" aria-pressed={!who} className={'biz-chip' + (!who ? ' on' : '')} onClick={() => setWho('')}>Everyone</button>
          {team.map(m => <button type="button" key={m.id} aria-pressed={who === m.id} className={'biz-chip' + (who === m.id ? ' on' : '')} onClick={() => setWho(m.id)}>{m.name}</button>)}
        </div>
      )}

      <div className="card bk-list">
        {list === null && <p className="bk-empty">Loading…</p>}
        {list && rows.length === 0 && <p className="bk-empty">No bookings on this day.</p>}
        {rows.map(row => row.block ? (
          <button type="button" key={row.block.id} className="bk-block" onClick={() => setBlocking(row.block!)}>
            <span className="bk-time">{row.block.all_day ? 'All day' : row.block.from}<small>{row.block.all_day ? '' : `to ${row.block.to}`}</small></span>
            <span><b>{row.block.label}</b><small>{row.block.staff_id ? staffName(row.block.staff_id) ?? 'Team member' : 'Blocked'}{row.block.days ? ' · repeats' : ''}</small></span>
          </button>
        ) : row.booking && ((b) => (
          <button type="button" key={b.id} className={'bk-appt' + (b.status === 'cancelled' ? ' gone' : '')} onClick={() => setOpen(b)}>
            <span className="bk-time">{time(b.starts_at)}<small>{mins(b.duration_min)}</small></span>
            <span className="bk-bar" style={{ background: b.status === 'cancelled' ? '#c9c0b2' : b.owed === 0 ? '#1e6b34' : b.paid > 0 ? '#5B21B6' : '#c45a37' }} />
            <span className="bk-who">
              <b>{b.customer_name}</b><span>{b.service_name}{b.staff_name && !who ? ` · ${b.staff_name}` : ''}</span>
              <span className={'bk-pill ' + (b.status !== 'confirmed' ? 'grey' : b.owed === 0 ? 'ok' : b.paid > 0 ? 'mid' : 'due')}>
                {b.status === 'cancelled' ? 'Cancelled' : b.status === 'completed' ? 'Done' : b.status === 'no_show' ? "Didn't come" : b.owed === 0 ? 'Paid in full' : b.paid > 0 ? `Deposit paid · ${fmt(b.owed)} at the shop` : `${fmt(b.owed)} at the shop`}
              </span>
            </span>
          </button>
        ))(row.booking))}
      </div>
      <div className="bk-buttons">
        <button type="button" className="btn-dark bk-add" onClick={() => setAdding(true)}>+ Add a booking</button>
        <button type="button" className="btn-sm pickup-edit bk-blockbtn" onClick={() => setBlocking('new')}>Block time</button>
      </div>

      {open && <BookingSheet b={open} onClose={() => setOpen(null)} onAct={a => act(open, a)} />}
      {blocking && <BlockTimeSheet block={blocking === 'new' ? null : blocking} day={day} onClose={() => setBlocking(null)} />}
      {adding && <AddBooking day={day} onClose={() => setAdding(false)} onAdded={b => { setList(l => [...(l ?? []), b]); setDay(dayKey(new Date(b.starts_at))); setAdding(false); }} />}
    </div>
  );
}

function BookingSheet({ b, onClose, onAct }: { b: SellerBooking; onClose: () => void; onAct: (a: 'complete' | 'no_show' | 'cancel') => void }) {
  const { fmt } = useStore();
  const started = new Date(b.starts_at).getTime() <= Date.now();
  return (
    <div className="sheet-overlay vf-overlay" role="dialog" aria-modal="true" aria-label={b.customer_name} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-card bk-sheet">
        <div className="vf-head"><h2>{b.customer_name}</h2><button type="button" className="vf-x" aria-label="Close" onClick={onClose}>×</button></div>
        <p className="bk-sub">{b.service_name}{b.staff_name ? ` with ${b.staff_name}` : ''} · {new Date(b.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, {time(b.starts_at)} – {time(b.ends_at)}</p>
        <div className="bk-money">
          <div><span>Price</span><b>{fmt(b.price)}</b></div>
          <div><span>Paid online</span><b>{fmt(b.paid)}</b></div>
          <div><span>To pay at the shop</span><b>{fmt(b.owed)}</b></div>
          {b.tips > 0 && <div><span>Tips</span><b>{fmt(b.tips)}</b></div>}
        </div>
        {b.note && <p className="bk-note">"{b.note}"</p>}
        <div className="bk-contact">
          {b.phone && <a className="btn-sm pickup-edit" href={`https://wa.me/${b.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener">WhatsApp</a>}
          {b.phone && <a className="btn-sm pickup-edit" href={`tel:${b.phone.replace(/[^\d+]/g, '')}`}>Call</a>}
          {b.email && <a className="btn-sm pickup-edit" href={`mailto:${b.email}`}>Email</a>}
        </div>
        {b.status === 'confirmed' && (
          <div className="bk-actions">
            {started ? (
              <>
                <button type="button" className="btn-dark" onClick={() => onAct('complete')}>Done</button>
                <button type="button" className="btn-sm pickup-edit" onClick={() => onAct('no_show')}>Didn't come</button>
              </>
            ) : <button type="button" className="link-btn bk-cancel" onClick={() => onAct('cancel')}>Cancel this booking</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function AddBooking({ day, onClose, onAdded }: { day: string; onClose: () => void; onAdded: (b: SellerBooking) => void }) {
  const { s, live, flash, fmt } = useStore();
  const [services, setServices] = useState<Service[] | null>(live ? null : [
    { id: 'd1', name: 'Silk press', description: null, duration_min: 75, price: 20000, payment: 'deposit', deposit_type: 'fixed', deposit_value: 5000, deposit: 5000, active: true, sort: 0, addons: [{ id: 'a1', name: 'Hollywood waves', price: 10000, duration_min: 45 }, { id: 'a2', name: 'Trim', price: 3000, duration_min: 15 }] },
    { id: 'd3', name: 'Bridal hair & makeup', description: null, duration_min: 240, price: 250000, payment: 'contact', deposit_type: 'fixed', deposit_value: 0, deposit: 0, active: true, sort: 2, addons: [] },
  ]);
  const [f, setF] = useState({ service_id: '', date: day, time: '10:00', name: '', phone: '', email: '', paid: '', price: '', staff_id: '' });
  const team = (s.bookings?.staff ?? []).filter(m => m.active);
  const [extras, setExtras] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (live) api.services(s.token).then(r => setServices(r.services)).catch(() => setServices([]));
  }, [live, s.token]);
  const svc = services?.find(x => x.id === f.service_id) ?? services?.[0];
  const chosen = (svc?.addons ?? []).filter(a => extras.includes(a.id));
  const listPrice = (svc?.price ?? 0) + chosen.reduce((t, a) => t + a.price, 0);
  const duration = (svc?.duration_min ?? 0) + chosen.reduce((t, a) => t + a.duration_min, 0);
  const price = f.price ? Number(f.price) : listPrice;

  const save = async () => {
    if (!svc) return setError('Add a service first (Business → Services & hours).');
    if (!f.name.trim()) return setError("Enter the customer's name.");
    setBusy(true);
    const starts = new Date(`${f.date}T${f.time}:00`).toISOString();
    try {
      const body = { service_id: svc.id, starts_at: starts, name: f.name.trim(), phone: f.phone.trim() || undefined, email: f.email.trim() || undefined, paid: Number(f.paid) || 0,
        ...(extras.length ? { addon_ids: extras } : {}), ...(f.price ? { price: Number(f.price) } : {}), ...(f.staff_id ? { staff_id: f.staff_id } : {}) };
      const b = live ? (await api.addBooking(s.token, body)).booking : {
        id: 'd' + Date.now(), service_id: svc.id, service_name: [svc.name, ...chosen.map(a => a.name)].join(' + '), staff_id: f.staff_id || null, staff_name: team.find(m => m.id === f.staff_id)?.name ?? null, duration_min: duration, starts_at: starts, ends_at: new Date(new Date(starts).getTime() + duration * 60000).toISOString(),
        status: 'confirmed', customer_name: body.name, email: body.email ?? '', phone: body.phone ?? '', note: null, currency_code: 'ngn', price, deposit: 0, paid: body.paid, owed: price - body.paid, tips: 0, refund_due: 0, refunded_at: null, cancelled_by: null,
      } as SellerBooking;
      flash('Booking added');
      onAdded(b);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add it.');
      setBusy(false);
    }
  };

  return (
    <div className="sheet-overlay vf-overlay" role="dialog" aria-modal="true" aria-label="Add a booking" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-card bk-sheet">
        <div className="vf-head"><h2>Add a booking</h2><button type="button" className="vf-x" aria-label="Close" onClick={onClose}>×</button></div>
        <p className="bk-sub">For walk-ins and bookings made by phone or WhatsApp.</p>
        <label className="biz-field"><span>Service</span>
          <select className="field" value={svc?.id ?? ''} onChange={e => { setF({ ...f, service_id: e.target.value, price: '' }); setExtras([]); }}>
            {(services ?? []).map(x => <option key={x.id} value={x.id}>{x.name}{x.price ? ` · ${fmt(x.price)}` : ''}</option>)}
          </select>
        </label>
        {(svc?.addons ?? []).length > 0 && (
          <div className="bk-addons" role="group" aria-label="Add-ons">
            {(svc?.addons ?? []).map(a => (
              <label key={a.id} className="bk-addon"><input type="checkbox" checked={extras.includes(a.id)} onChange={e => setExtras(e.target.checked ? [...extras, a.id] : extras.filter(x => x !== a.id))} />
                <span>{a.name}</span><small>+{fmt(a.price)}{a.duration_min ? ` · +${a.duration_min} min` : ''}</small></label>
            ))}
          </div>
        )}
        {team.length > 0 && (
          <label className="biz-field"><span>With</span>
            <select className="field" value={f.staff_id} onChange={e => setF({ ...f, staff_id: e.target.value })}>
              <option value="">Not assigned</option>
              {team.filter(m => !svc || !m.service_ids || m.service_ids.includes(svc.id)).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        <label className="biz-field"><span>Price agreed{svc?.payment === 'contact' ? '' : ' (if different)'}</span>
          <input className="field" inputMode="numeric" placeholder={listPrice ? String(listPrice) : 'e.g. 350000'} value={f.price} onChange={e => setF({ ...f, price: e.target.value.replace(/[^0-9]/g, '') })} />
        </label>
        <div className="biz-two">
          <label className="biz-field"><span>Day</span><input type="date" className="field" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></label>
          <label className="biz-field"><span>Time</span><input type="time" className="field" value={f.time} onChange={e => setF({ ...f, time: e.target.value })} /></label>
        </div>
        <label className="biz-field"><span>Customer's name</span><input className="field" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
        <div className="biz-two">
          <label className="biz-field"><span>Phone</span><input className="field" inputMode="tel" value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} /></label>
          <label className="biz-field"><span>Already paid</span><input className="field" inputMode="numeric" placeholder="0" value={f.paid} onChange={e => setF({ ...f, paid: e.target.value.replace(/[^0-9]/g, '') })} /></label>
        </div>
        <label className="biz-field"><span>Email (optional: they get the confirmation and reminders)</span><input className="field" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="button" className="btn-dark biz-wide" disabled={busy} onClick={save}>{busy ? 'Adding…' : 'Add booking'}</button>
      </div>
    </div>
  );
}
