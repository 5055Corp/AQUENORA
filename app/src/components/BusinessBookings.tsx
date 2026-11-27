// Business → booking tools: services and opening hours, calendar sync, and the "Appointment booked" email.
import { useEffect, useState } from 'react';
import { api, type BookingEmail, type BookingSettings, type Day, type Service, type ServiceInput } from '../api';
import { useStore } from '../store';
import { defaultBookingSettings } from './Business';

const DAYS: [Day, string][] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];

const DEMO_SERVICES: Service[] = [
  { id: 'd1', name: 'Bridal trial makeup', description: null, duration_min: 60, price: 45000, payment: 'deposit', deposit_type: 'fixed', deposit_value: 10000, deposit: 10000, active: true, sort: 0 },
  { id: 'd2', name: 'Knotless braids', description: 'Mid-back length', duration_min: 180, price: 30000, payment: 'deposit', deposit_type: 'percent', deposit_value: 30, deposit: 9000, active: true, sort: 1 },
  { id: 'd3', name: 'Lash refill', description: null, duration_min: 30, price: 8000, payment: 'none', deposit_type: 'fixed', deposit_value: 0, deposit: 0, active: true, sort: 2 },
];

const minutes = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} hr`);

export function ServicesAndHours() {
  const { s, live, h1Size, fmt, flash, saveBookings } = useStore();
  const [services, setServices] = useState<Service[] | null>(live ? null : DEMO_SERVICES);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const settings = s.bookings ?? defaultBookingSettings(s.country);
  const [draft, setDraft] = useState<BookingSettings>(settings);
  const [calendar, setCalendar] = useState('');

  useEffect(() => {
    if (live) api.services(s.token).then(r => setServices(r.services)).catch(e => flash(e instanceof Error ? e.message : 'Could not load services.'));
  }, [live, s.token, flash]);

  const save = async (patch: Partial<BookingSettings>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const err = await saveBookings(next);
    if (err) flash(err);
  };
  const setDay = (d: Day, open: boolean) => save({ hours: { ...draft.hours, [d]: open ? [{ from: '09:00', to: '18:00' }] : [] } });
  const setTime = (d: Day, which: 'from' | 'to', v: string) => {
    const iv = draft.hours[d][0] ?? { from: '09:00', to: '18:00' };
    setDraft({ ...draft, hours: { ...draft.hours, [d]: [{ ...iv, [which]: v }] } });
  };
  const getCalendar = async () => {
    if (!live) return setCalendar('webcal://api.aquenora.com/bookings-calendar/demo.ics');
    try { setCalendar((await api.calendarLink(s.token)).webcal); } catch (e) { flash(e instanceof Error ? e.message : 'Could not make the link.'); }
  };

  if (editing) return <ServiceForm service={editing === 'new' ? null : editing} onDone={svc => {
    if (svc) setServices(list => { const l = list ?? []; return l.some(x => x.id === svc.id) ? l.map(x => (x.id === svc.id ? svc : x)) : [...l, svc]; });
    setEditing(null);
  }} onDelete={id => { setServices(l => (l ?? []).filter(x => x.id !== id)); setEditing(null); }} />;

  return (
    <div className="biz">
      <h1 className="h1" style={{ fontSize: h1Size }}>Services & hours</h1>
      <label className="set-switch biz-switch">
        <span><b>Take bookings</b><small>Customers can book from your store and your booking link.</small></span>
        <input type="checkbox" role="switch" checked={draft.enabled} onChange={e => save({ enabled: e.target.checked })} />
        <span className="set-switch-ui" aria-hidden="true" />
      </label>

      <h2 className="biz-sec">Services</h2>
      <div className="biz-list">
        {services === null && <div className="biz-row static"><span className="biz-row-text"><small>Loading…</small></span></div>}
        {services?.length === 0 && <div className="biz-row static"><span className="biz-row-text"><b>No services yet</b><small>Add what customers can book, e.g. "Braids, 3 hours, ₦30,000".</small></span></div>}
        {services?.map(svc => (
          <button type="button" key={svc.id} className="biz-row" onClick={() => setEditing(svc)}>
            <span className="biz-row-text">
              <b>{svc.name}{svc.active ? '' : ' (hidden)'}</b>
              <small>{minutes(svc.duration_min)} · {svc.payment === 'full' ? 'pay in full online' : svc.payment === 'none' ? 'pay at the appointment' : `deposit ${fmt(svc.deposit)}`}</small>
            </span>
            <b className="biz-price">{fmt(svc.price)}</b>
          </button>
        ))}
      </div>
      <button type="button" className="btn-dark biz-wide" onClick={() => setEditing('new')}>+ Add a service</button>

      <h2 className="biz-sec">Opening hours</h2>
      <div className="card biz-card">
        {DAYS.map(([d, label]) => {
          const iv = draft.hours[d][0];
          return (
            <div className="biz-hours" key={d}>
              <span className="biz-day">{label}</span>
              {iv ? (
                <span className="biz-times">
                  <input type="time" className="field" value={iv.from} aria-label={`${label} opens`} onChange={e => setTime(d, 'from', e.target.value)} onBlur={() => save({})} />
                  <span>–</span>
                  <input type="time" className="field" value={iv.to} aria-label={`${label} closes`} onChange={e => setTime(d, 'to', e.target.value)} onBlur={() => save({})} />
                </span>
              ) : <span className="biz-closed">Closed</span>}
              <input type="checkbox" role="switch" className="biz-mini" checked={!!iv} aria-label={`Open on ${label}`} onChange={e => setDay(d, e.target.checked)} />
            </div>
          );
        })}
      </div>

      <h2 className="biz-sec">Where and rules</h2>
      <div className="card biz-card">
        <label className="biz-field"><span>Address (shown to customers who book)</span>
          <input className="field" value={draft.address} maxLength={300} placeholder="e.g. 14 Admiralty Way, Lekki, Lagos" onChange={e => setDraft({ ...draft, address: e.target.value })} onBlur={() => save({})} />
        </label>
        <div className="biz-two">
          <label className="biz-field"><span>Free changes until</span>
            <select className="field" value={draft.cancel_hours} onChange={e => save({ cancel_hours: Number(e.target.value) })}>
              {[2, 6, 12, 24, 48, 72].map(h => <option key={h} value={h}>{h} hours before</option>)}
            </select>
          </label>
          <label className="biz-field"><span>Break between bookings</span>
            <select className="field" value={draft.buffer_min} onChange={e => save({ buffer_min: Number(e.target.value) })}>
              {[0, 10, 15, 30, 45, 60].map(m => <option key={m} value={m}>{m ? `${m} min` : 'None'}</option>)}
            </select>
          </label>
        </div>
        <p className="biz-note">No-show protection: if a customer doesn't come, or cancels after this time, you keep their deposit.</p>
      </div>

      <h2 className="biz-sec">Your calendar</h2>
      <div className="card biz-card">
        <b>See bookings in Google or Apple Calendar</b>
        <p className="biz-note">New bookings appear in your phone's calendar by themselves.</p>
        {calendar ? (
          <>
            <a className="btn-dark biz-wide" href={calendar}>Add to my calendar</a>
            <p className="biz-note">On Google Calendar (computer): Other calendars → + → From URL, and paste: <span className="biz-link small">{calendar.replace(/^webcal:/, 'https:')}</span></p>
          </>
        ) : <button type="button" className="btn-sm pickup-edit" onClick={getCalendar}>Get my calendar link</button>}
      </div>
    </div>
  );
}

function ServiceForm({ service, onDone, onDelete }: { service: Service | null; onDone: (s: Service | null) => void; onDelete: (id: string) => void }) {
  const { s, live, h1Size, flash, country } = useStore();
  const sym = country.sym.trim();
  const [f, setF] = useState<ServiceInput>(service ?? { name: '', duration_min: 60, price: 0, payment: 'deposit', deposit_type: 'fixed', deposit_value: 0, active: true });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (p: ServiceInput) => { setF({ ...f, ...p }); setError(''); };

  const save = async () => {
    if (!f.name?.trim()) return setError('Name the service.');
    if (!f.price || f.price <= 0) return setError('Set the price.');
    if (f.payment === 'deposit' && !f.deposit_value) return setError('Set the deposit.');
    setBusy(true);
    try {
      const body: ServiceInput = { ...f, name: f.name.trim(), description: f.description?.trim() || null };
      let saved: Service;
      if (!live) {
        const deposit = f.payment === 'full' ? f.price : f.payment === 'none' ? 0 : f.deposit_type === 'percent' ? Math.round(f.price * (f.deposit_value ?? 0) / 100) : (f.deposit_value ?? 0);
        saved = { ...(service ?? { id: 'd' + Date.now(), sort: 99 }), ...body, deposit } as Service;
      } else {
        saved = service ? (await api.updateService(s.token, service.id, body)).service : (await api.addService(s.token, body)).service;
      }
      flash(service ? 'Service saved' : 'Service added');
      onDone(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!service || !window.confirm(`Delete "${service.name}"? Bookings already made stay.`)) return;
    if (live) await api.deleteService(s.token, service.id).catch(() => {});
    onDelete(service.id);
  };

  return (
    <div className="biz">
      <button type="button" className="biz-back" onClick={() => onDone(null)}>‹ Services & hours</button>
      <h1 className="h1" style={{ fontSize: h1Size }}>{service ? 'Edit service' : 'New service'}</h1>
      <div className="card biz-card">
        <label className="biz-field"><span>Name</span><input className="field" value={f.name ?? ''} maxLength={80} placeholder="e.g. Knotless braids" onChange={e => set({ name: e.target.value })} /></label>
        <label className="biz-field"><span>Details (optional)</span><textarea className="field" rows={2} maxLength={600} value={f.description ?? ''} placeholder="e.g. Mid-back length, hair included" onChange={e => set({ description: e.target.value })} /></label>
        <div className="biz-two">
          <label className="biz-field"><span>How long</span>
            <select className="field" value={f.duration_min} onChange={e => set({ duration_min: Number(e.target.value) })}>
              {[15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480].map(m => <option key={m} value={m}>{minutes(m)}</option>)}
            </select>
          </label>
          <label className="biz-field"><span>Price{sym ? ` (${sym})` : ''}</span><input className="field" inputMode="numeric" value={f.price || ''} onChange={e => set({ price: Number(e.target.value.replace(/[^0-9]/g, '')) })} /></label>
        </div>
        <span className="biz-field"><span>How customers pay</span></span>
        <div className="biz-chips" role="group" aria-label="How customers pay">
          {([['deposit', 'Deposit online'], ['full', 'Full price online'], ['none', 'At the appointment']] as const).map(([k, l]) => (
            <button type="button" key={k} aria-pressed={f.payment === k} className={'biz-chip' + (f.payment === k ? ' on' : '')} onClick={() => set({ payment: k })}>{l}</button>
          ))}
        </div>
        {f.payment === 'deposit' && (
          <div className="biz-two">
            <label className="biz-field"><span>Deposit</span><input className="field" inputMode="numeric" value={f.deposit_value || ''} onChange={e => set({ deposit_value: Number(e.target.value.replace(/[^0-9.]/g, '')) })} /></label>
            <label className="biz-field"><span>&nbsp;</span>
              <select className="field" value={f.deposit_type} onChange={e => set({ deposit_type: e.target.value as 'fixed' | 'percent' })}>
                <option value="fixed">amount</option><option value="percent">% of the price</option>
              </select>
            </label>
          </div>
        )}
        <p className="biz-note">{f.payment === 'none' ? 'Customers can still choose to pay in full online.' : f.payment === 'deposit' ? 'Customers can pay the rest online before the visit, or at the appointment.' : 'Customers pay everything when they book.'} AQUENORA's 3% fee is added on top for the customer; you get your full price.</p>
        <label className="set-switch biz-switch">
          <span><b>Show on my booking page</b></span>
          <input type="checkbox" role="switch" checked={f.active !== false} onChange={e => set({ active: e.target.checked })} />
          <span className="set-switch-ui" aria-hidden="true" />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="button" className="btn-dark biz-wide" disabled={busy} onClick={save}>{busy ? 'Saving…' : service ? 'Save' : 'Add service'}</button>
        {service && <button type="button" className="link-btn biz-more" onClick={remove}>Delete this service</button>}
      </div>
    </div>
  );
}

const DEFAULT_EMAIL: BookingEmail = {
  subject: 'Your appointment with {shop} is booked',
  message: "Hi {customer},\n\nThank you for booking {service} with {shop}. We're looking forward to seeing you on {date} at {time}.\n\nIf anything changes, you can change or cancel your booking with the link below.",
};
const WORDS = ['customer', 'service', 'date', 'time', 'location', 'total', 'paid', 'owed', 'shop'];

export function BookingEmailEditor() {
  const { s, h1Size, flash, saveBookingEmail, shopNameShown } = useStore();
  const [e, setE] = useState<BookingEmail>(s.bookingEmail ?? DEFAULT_EMAIL);
  const [focus, setFocus] = useState<'subject' | 'message'>('message');
  const [preview, setPreview] = useState(false);
  const add = (w: string) => setE(x => ({ ...x, [focus]: `${x[focus]}${x[focus].endsWith(' ') || !x[focus] ? '' : ' '}{${w}}` }));
  const sample: Record<string, string> = { customer: 'Chioma', service: 'Bridal trial makeup', date: 'Sat, 28 Nov', time: '11:30', location: s.bookings?.address || '14 Admiralty Way, Lekki', total: '₦45,000', paid: '₦10,000', owed: '₦35,000', shop: shopNameShown };
  const fill = (t: string) => t.replace(/\{(\w+)\}/g, (a, k: string) => sample[k] ?? a);
  const save = async (value: BookingEmail | null) => {
    const err = await saveBookingEmail(value);
    flash(err || (value ? 'Saved. New bookings get this email.' : 'Back to AQUENORA\'s email'));
    if (!value) setE(DEFAULT_EMAIL);
  };
  return (
    <div className="biz">
      <h1 className="h1" style={{ fontSize: h1Size }}>Booking emails</h1>
      <div className="card biz-card">
        <b>"Appointment booked" email</b>
        <p className="biz-note">Sent the moment someone books. Write it your way. Tap a word to add it.</p>
        <label className="biz-field"><span>Subject</span><input className="field" value={e.subject} maxLength={150} onFocus={() => setFocus('subject')} onChange={ev => setE({ ...e, subject: ev.target.value })} /></label>
        <label className="biz-field"><span>Message</span><textarea className="field" rows={7} maxLength={3000} value={e.message} onFocus={() => setFocus('message')} onChange={ev => setE({ ...e, message: ev.target.value })} /></label>
        <div className="biz-chips">{WORDS.map(w => <button type="button" key={w} className="biz-chip word" onClick={() => add(w)}>+ {w}</button>)}</div>
        <p className="biz-note">Always added underneath: where, when, the total, what's paid and what's left to pay, plus buttons to change the booking and add it to their calendar.</p>
        {preview && (
          <div className="biz-preview">
            <b>{fill(e.subject)}</b>
            <p>{fill(e.message)}</p>
          </div>
        )}
        <div className="biz-btns">
          <button type="button" className="btn-sm pickup-edit" onClick={() => setPreview(v => !v)}>{preview ? 'Hide preview' : 'Preview'}</button>
          <button type="button" className="btn-dark" onClick={() => save(e)}>Save</button>
        </div>
        {s.bookingEmail && <button type="button" className="link-btn biz-more" onClick={() => save(null)}>Use AQUENORA's email instead</button>}
      </div>
      <div className="card biz-card">
        <b>Also sent by themselves</b>
        <p className="biz-note">Reminders the day before and 2 hours before · a message when a booking is changed or cancelled · receipts for payments and tips.</p>
      </div>
    </div>
  );
}
