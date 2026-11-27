// The customer side of bookings: book (service → day → time → details → pay), and their own booking page
// (from the email link): pay the rest, tip, change, cancel, add to calendar.
import { useEffect, useMemo, useState } from 'react';
import { bookingApi, LIVE, type BookingPage, type CustomerBooking, type PayChoice } from '../api';
import { cardTextOf, STORE_FONTS, type StoreDesign } from '../design';

type Props = { handle: string; shopName: string; design: StoreDesign; fmt: (n: number) => string; onBack: () => void };
const DAY = 86400000;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hm = (iso: string, tz?: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
const longDate = (iso: string, tz?: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });
const mins = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m / 60} ${m === 60 ? 'hour' : 'hours'}`);
const round2 = (n: number) => Math.round(n * 100) / 100;

const DEMO_PAGE = (name: string, handle: string): BookingPage => ({
  shop: { name, handle, address: '14 Admiralty Way, Lekki, Lagos', timezone: 'Africa/Lagos', cancel_hours: 24, days_ahead: 60, currency_code: 'ngn' },
  fee_percent: 3,
  services: [
    { id: 'd1', name: 'Bridal trial makeup', description: 'Soft glam, lashes included', duration_min: 60, price: 45000, payment: 'deposit', deposit_type: 'fixed', deposit_value: 10000, deposit: 10000, active: true, sort: 0, pay_choices: ['deposit', 'full'] },
    { id: 'd2', name: 'Knotless braids', description: 'Mid-back length', duration_min: 180, price: 30000, payment: 'deposit', deposit_type: 'percent', deposit_value: 30, deposit: 9000, active: true, sort: 1, pay_choices: ['deposit', 'full'] },
    { id: 'd3', name: 'Lash refill', description: null, duration_min: 30, price: 8000, payment: 'none', deposit_type: 'fixed', deposit_value: 0, deposit: 0, active: true, sort: 2, pay_choices: ['later', 'full'] },
  ],
});
const demoSlots = (date: string) => ['09:00', '10:30', '11:30', '13:00', '14:30', '16:00'].filter((_, i) => (date.charCodeAt(9) + i) % 3 !== 0).map(t => new Date(`${date}T${t}:00`).toISOString());

function useColours(d: StoreDesign) {
  return { bg: d.colors.background, ink: d.colors.text, card: d.colors.card, cardInk: cardTextOf(d), accent: d.colors.accent, onAccent: d.colors.accent_text, heading: STORE_FONTS[d.fonts.heading].family, body: STORE_FONTS[d.fonts.body].family };
}

export function BookingFlow({ handle, shopName, design, fmt, onBack }: Props) {
  const c = useColours(design);
  const [page, setPage] = useState<BookingPage | null>(LIVE ? null : DEMO_PAGE(shopName, handle));
  const [error, setError] = useState('');
  const [svcId, setSvcId] = useState('');
  const days = useMemo(() => Array.from({ length: Math.min(page?.shop.days_ahead ?? 30, 30) }, (_, i) => new Date(Date.now() + i * DAY)), [page]);
  const [date, setDate] = useState(() => ymd(new Date(Date.now() + DAY)));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [slot, setSlot] = useState('');
  const [step, setStep] = useState<'pick' | 'details'>('pick');
  const [pay, setPay] = useState<PayChoice>('deposit');
  const [who, setWho] = useState({ name: '', email: '', phone: '', note: '', news: true });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<CustomerBooking | null>(null);

  useEffect(() => {
    if (LIVE) bookingApi.page(handle).then(setPage).catch(e => setError(e instanceof Error ? e.message : 'Could not load.'));
  }, [handle]);
  const svc = page?.services.find(s => s.id === svcId) ?? page?.services[0];
  useEffect(() => { if (svc && !svc.pay_choices.includes(pay)) setPay(svc.pay_choices[0]); }, [svc, pay]);
  useEffect(() => {
    if (!svc) return;
    setSlots(null);
    setSlot('');
    if (!LIVE) { setSlots(demoSlots(date)); return; }
    bookingApi.slots(handle, svc.id, date).then(r => setSlots(r.slots)).catch(() => setSlots([]));
  }, [handle, svc, date]);

  if (error) return <Shell c={c} title={shopName} onBack={onBack}><p className="bf-empty">{error}</p></Shell>;
  if (!page || !svc) return <Shell c={c} title={shopName} onBack={onBack}><p className="bf-empty">{page ? 'No services to book yet.' : 'Loading…'}</p></Shell>;
  if (done) return <Shell c={c} title={shopName} onBack={onBack}><Confirmed b={done} fmt={fmt} c={c} /></Shell>;

  const payNow = pay === 'full' ? svc.price : pay === 'deposit' ? svc.deposit : 0;
  const fee = round2(payNow * page.fee_percent / 100);
  const tz = page.shop.timezone;

  const book = async () => {
    if (who.name.trim().length < 2) return setError('Enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(who.email.trim())) return setError('Enter a valid email address.');
    if (who.phone.trim().length < 7) return setError('Enter your phone number.');
    setError('');
    setBusy(true);
    try {
      if (!LIVE) {
        const paid = payNow;
        setDone({ id: 'demo', service_name: svc.name, duration_min: svc.duration_min, starts_at: slot, ends_at: new Date(new Date(slot).getTime() + svc.duration_min * 60000).toISOString(), status: 'confirmed', customer_name: who.name, currency_code: 'ngn', price: svc.price, paid, owed: svc.price - paid, tips: 0, refund_due: 0, refunded: false, can_change: true, cancel_hours: page.shop.cancel_hours, timezone: tz, shop: { name: shopName, handle, address: page.shop.address } });
        return;
      }
      const r = await bookingApi.book(handle, { service_id: svc.id, starts_at: slot, name: who.name.trim(), email: who.email.trim(), phone: who.phone.trim(), note: who.note.trim() || undefined, pay, return_url: window.location.href.split('?')[0], marketing_opt_in: who.news });
      if (r.payment_url) window.location.href = r.payment_url;
      else setDone(r.booking);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Shell c={c} title={shopName} onBack={step === 'details' ? () => setStep('pick') : onBack} backLabel={step === 'details' ? 'Change time' : undefined}>
      {step === 'pick' ? (
        <>
          <div className="bf-step">1 · Choose a service</div>
          {page.services.map(s => (
            <button type="button" key={s.id} className={'bf-opt' + (s.id === svc.id ? ' on' : '')} style={s.id === svc.id ? { borderColor: c.accent } : undefined} onClick={() => setSvcId(s.id)}>
              <span><b>{s.name}</b><small>{mins(s.duration_min)}{s.description ? ` · ${s.description}` : ''}</small></span>
              <b>{s.payment === 'deposit' && s.deposit < s.price ? '' : ''}{fmt(s.price)}</b>
            </button>
          ))}
          <div className="bf-step">2 · Pick a day</div>
          <div className="bf-days">
            {days.map(d => {
              const k = ymd(d);
              return (
                <button type="button" key={k} className={'bf-day' + (k === date ? ' on' : '')} style={k === date ? { background: c.accent, borderColor: c.accent, color: c.onAccent } : undefined} onClick={() => setDate(k)}>
                  {d.toLocaleDateString('en-GB', { weekday: 'short' })}<b>{d.getDate()}</b>
                </button>
              );
            })}
          </div>
          <div className="bf-step">3 · Pick a time</div>
          {slots === null ? <p className="bf-empty">Finding free times…</p> : slots.length === 0 ? <p className="bf-empty">No free times on this day. Try another day.</p> : (
            <div className="bf-slots">
              {slots.map(t => (
                <button type="button" key={t} className={'bf-slot' + (t === slot ? ' on' : '')} style={t === slot ? { background: c.accent, borderColor: c.accent, color: c.onAccent } : undefined} onClick={() => setSlot(t)}>{hm(t, tz)}</button>
              ))}
            </div>
          )}
          <button type="button" className="bf-go" disabled={!slot} style={{ background: c.accent, color: c.onAccent }} onClick={() => setStep('details')}>
            {slot ? `Continue · ${longDate(slot, tz)}, ${hm(slot, tz)}` : 'Pick a time'}
          </button>
        </>
      ) : (
        <>
          <div className="bf-sum">
            <div><span>{svc.name}</span><b>{fmt(svc.price)}</b></div>
            <div className="mute"><span>{longDate(slot, tz)}, {hm(slot, tz)} · {mins(svc.duration_min)}</span></div>
            {page.shop.address && <div className="mute"><span>{page.shop.address}</span></div>}
          </div>
          {svc.pay_choices.length > 1 && (
            <>
              <div className="bf-step">How would you like to pay?</div>
              {svc.pay_choices.map(p => (
                <button type="button" key={p} className={'bf-opt' + (p === pay ? ' on' : '')} style={p === pay ? { borderColor: c.accent } : undefined} onClick={() => setPay(p)}>
                  <span><b>{p === 'deposit' ? `Pay the deposit now (${fmt(svc.deposit)})` : p === 'full' ? 'Pay in full now' : 'Pay at the appointment'}</b>
                    <small>{p === 'deposit' ? `${fmt(svc.price - svc.deposit)} at the appointment` : p === 'full' ? 'Nothing to pay on the day' : 'Nothing to pay now'}</small></span>
                </button>
              ))}
            </>
          )}
          <div className="bf-step">Your details</div>
          <input className="bf-field" placeholder="Full name" autoComplete="name" value={who.name} onChange={e => setWho({ ...who, name: e.target.value })} />
          <input className="bf-field" placeholder="Email" type="email" autoComplete="email" value={who.email} onChange={e => setWho({ ...who, email: e.target.value })} />
          <input className="bf-field" placeholder="Phone (WhatsApp if you have it)" type="tel" autoComplete="tel" value={who.phone} onChange={e => setWho({ ...who, phone: e.target.value })} />
          <textarea className="bf-field" rows={2} placeholder="Anything they should know? (optional)" value={who.note} onChange={e => setWho({ ...who, note: e.target.value })} />
          <label className="bf-check"><input type="checkbox" checked={who.news} onChange={e => setWho({ ...who, news: e.target.checked })} /> Send me news and offers from {shopName}</label>
          <div className="bf-sum">
            {payNow > 0 ? (
              <>
                <div><span>{pay === 'deposit' ? 'Deposit' : 'Price'}</span><span>{fmt(payNow)}</span></div>
                <div className="mute"><span>Service fee ({page.fee_percent}%)</span><span>{fmt(fee)}</span></div>
                <div className="tot"><span>Pay now</span><b>{fmt(payNow + fee)}</b></div>
              </>
            ) : <div className="tot"><span>Pay at the appointment</span><b>{fmt(svc.price)}</b></div>}
          </div>
          {error && <p className="bf-err" role="alert">{error}</p>}
          <button type="button" className="bf-go" disabled={busy} style={{ background: c.accent, color: c.onAccent }} onClick={book}>
            {busy ? 'One moment…' : payNow > 0 ? `Book & pay ${fmt(payNow + fee)}` : 'Book now'}
          </button>
          <p className="bf-fine">{payNow > 0 ? `Secure payment by Paystack. ${shopName} receives the full price. ` : ''}Free changes up to {page.shop.cancel_hours} hours before.</p>
        </>
      )}
    </Shell>
  );
}

type Colours = ReturnType<typeof useColours>;

function Shell({ c, title, onBack, backLabel, children }: { c: Colours; title: string; onBack: () => void; backLabel?: string; children: React.ReactNode }) {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <div className="bf" style={{ background: c.bg, color: c.ink, fontFamily: c.body }}>
      <div className="bf-head">
        <button type="button" className="bf-back" style={{ color: c.ink }} onClick={onBack}>‹ {backLabel ?? 'Back to the shop'}</button>
        <div className="bf-title" style={{ fontFamily: c.heading }}>{title}</div>
      </div>
      <div className="bf-sheet" style={{ background: c.card, color: c.cardInk }}>{children}</div>
    </div>
  );
}

function Confirmed({ b, fmt, c }: { b: CustomerBooking; fmt: (n: number) => string; c: Colours }) {
  return (
    <div className="bf-done">
      <div className="bf-tick">✓</div>
      <h2 style={{ fontFamily: c.heading }}>You're booked!</h2>
      <p>We've emailed your confirmation, with a link to change, cancel or pay the rest.</p>
      <div className="bf-sum">
        <div><span>{b.service_name}</span><b>{longDate(b.starts_at, b.timezone)}</b></div>
        <div className="mute"><span>{hm(b.starts_at, b.timezone)} – {hm(b.ends_at, b.timezone)}</span><span>{b.shop.address}</span></div>
        <div className="tot"><span>Paid</span><b>{fmt(b.paid)}</b></div>
        {b.owed > 0 && <div><span>To pay at the appointment</span><span>{fmt(b.owed)}</span></div>}
      </div>
    </div>
  );
}

/** The customer's own booking page (from the email link, or back from Paystack). */
export function ManageBooking({ token, reference, design, fmt, onBack }: { token: string; reference: string | null; design: StoreDesign; fmt: (n: number) => string; onBack: () => void }) {
  const c = useColours(design);
  const [b, setB] = useState<CustomerBooking | null>(null);
  const [info, setInfo] = useState<{ online: boolean; fee_percent: number }>({ online: true, fee_percent: 3 });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [tip, setTip] = useState(2000);
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => bookingApi.get(token).then(r => { setB(r.booking); setInfo({ online: r.online, fee_percent: r.fee_percent }); }).catch(e => setError(e instanceof Error ? e.message : 'Could not load your booking.'));
    if (!LIVE) {
      // Preview: a deposit booking with the rest still to pay.
      const start = new Date(Date.now() + 3 * 86400000); start.setHours(12, 30, 0, 0);
      setB({ id: 'demo', service_name: 'Bridal trial makeup', duration_min: 60, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 3600000).toISOString(), status: 'confirmed', customer_name: 'Chioma Eze', currency_code: 'ngn', price: 45000, paid: 10000, owed: 35000, tips: 0, refund_due: 0, refunded: false, can_change: true, cancel_hours: 24, timezone: 'Africa/Lagos', shop: { name: 'Adire House', handle: 'adirehouse', address: '14 Admiralty Way, Lekki, Lagos' } });
      return;
    }
    if (!reference) { load(); return; }
    // Back from Paystack: record the payment first.
    bookingApi.verify(reference).then(r => {
      setB(r.booking);
      setMsg(r.status === 'paid' ? (r.kind === 'tip' ? 'Thank you for your tip! 💜' : r.kind === 'balance' ? 'Paid. Nothing more to pay on the day.' : 'Paid. You\'re booked!') : r.status === 'pending' ? "Your payment hasn't gone through yet." : "Your payment didn't go through. You haven't been charged.");
      const url = new URL(window.location.href);
      url.searchParams.delete('reference');
      url.searchParams.delete('trxref');
      window.history.replaceState(null, '', url.toString());
    }).catch(e => { setError(e instanceof Error ? e.message : 'Could not check the payment.'); load(); });
  }, [token, reference]);

  const go = async (body: Parameters<typeof bookingApi.act>[1]) => {
    setBusy(true);
    setError('');
    try {
      const r = await bookingApi.act(token, body);
      if (r.payment_url) { window.location.href = r.payment_url; return; }
      if (r.booking) setB(r.booking);
      setMsg(body.action === 'cancel' ? 'Your booking is cancelled.' : body.action === 'reschedule' ? 'Your booking is changed.' : '');
      setChanging(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
    setBusy(false);
  };
  const back = window.location.href.split('?')[0] + `?booking=${encodeURIComponent(token)}`;

  if (!b) return <Shell c={c} title="Your booking" onBack={onBack}><p className="bf-empty">{error || 'Loading…'}</p></Shell>;
  const fee = round2(b.owed * info.fee_percent / 100);
  return (
    <Shell c={c} title={b.shop.name} onBack={onBack}>
      {msg && <p className="bf-msg">{msg}</p>}
      <span className={'bf-status ' + b.status}>{b.status === 'confirmed' ? '✓ Booked' : b.status === 'cancelled' ? 'Cancelled' : b.status === 'completed' ? 'Done' : b.status === 'pending' ? 'Waiting for payment' : 'Missed'}</span>
      <h2 className="bf-h" style={{ fontFamily: c.heading }}>{b.service_name}</h2>
      <p className="bf-mute">{longDate(b.starts_at, b.timezone)} · {hm(b.starts_at, b.timezone)} – {hm(b.ends_at, b.timezone)}{b.shop.address ? ` · ${b.shop.address}` : ''}</p>
      <div className="bf-sum">
        <div><span>Total</span><span>{fmt(b.price)}</span></div>
        <div><span>Paid</span><span>{fmt(b.paid)}</span></div>
        {b.status !== 'cancelled' && <div className="tot"><span>Left to pay</span><b>{fmt(b.owed)}</b></div>}
        {b.refund_due > 0 && <div className="tot"><span>{b.refunded ? 'Refunded' : `Refund from ${b.shop.name}`}</span><b>{fmt(b.refund_due)}</b></div>}
      </div>
      {error && <p className="bf-err" role="alert">{error}</p>}

      {b.status === 'confirmed' && b.owed > 0 && info.online && (
        <>
          <button type="button" className="bf-go" disabled={busy} style={{ background: c.cardInk, color: c.card }} onClick={() => go({ action: 'pay_balance', return_url: back })}>
            Pay {fmt(b.owed)} now <span className="bf-light">(+ {fmt(fee)} fee)</span>
          </button>
          <p className="bf-fine">Or pay at the appointment.</p>
        </>
      )}

      {(b.status === 'confirmed' || b.status === 'completed') && info.online && (
        <>
          <div className="bf-step">Leave a tip <span className="bf-badge" style={{ background: c.accent, color: c.onAccent }}>100% to {b.shop.name}</span></div>
          <div className="bf-tips">
            {[1000, 2000, 5000].map(n => (
              <button type="button" key={n} className={'bf-slot' + (tip === n ? ' on' : '')} style={tip === n ? { background: c.accent, borderColor: c.accent, color: c.onAccent } : undefined} onClick={() => setTip(n)}>{fmt(n)}</button>
            ))}
            <input className="bf-field bf-tip-other" inputMode="numeric" placeholder="Other" aria-label="Other tip amount" onChange={e => setTip(Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} />
          </div>
          <button type="button" className="bf-go" disabled={busy || tip < 100} style={{ background: c.accent, color: c.onAccent }} onClick={() => go({ action: 'tip', amount: tip, return_url: back })}>Tip {fmt(tip)}</button>
          <p className="bf-fine">AQUENORA takes nothing from tips.</p>
        </>
      )}

      {b.status === 'confirmed' && (
        <div className="bf-row">
          <a className="bf-ghost" href={LIVE ? bookingApi.calendarFile(token) : '#'} style={{ color: c.cardInk, borderColor: c.cardInk + '33' }}>Calendar</a>
          {b.can_change && <button type="button" className="bf-ghost" style={{ color: c.cardInk, borderColor: c.cardInk + '33' }} onClick={() => setChanging(v => !v)}>Change</button>}
          {b.can_change && <button type="button" className="bf-ghost" style={{ color: c.cardInk, borderColor: c.cardInk + '33' }} onClick={() => window.confirm('Cancel this booking?') && go({ action: 'cancel' })}>Cancel</button>}
        </div>
      )}
      {b.status === 'confirmed' && !b.can_change && <p className="bf-fine">Changes online are possible up to {b.cancel_hours} hours before. Please contact {b.shop.name}.</p>}
      {changing && <Reschedule b={b} c={c} busy={busy} onPick={t => go({ action: 'reschedule', starts_at: t })} />}
    </Shell>
  );
}

function Reschedule({ b, c, busy, onPick }: { b: CustomerBooking; c: Colours; busy: boolean; onPick: (iso: string) => void }) {
  const [page, setPage] = useState<BookingPage | null>(null);
  const [date, setDate] = useState(() => ymd(new Date(b.starts_at)));
  const [slots, setSlots] = useState<string[] | null>(null);
  useEffect(() => { if (LIVE) bookingApi.page(b.shop.handle).then(setPage).catch(() => {}); }, [b.shop.handle]);
  const svc = page?.services.find(s => s.name === b.service_name);
  useEffect(() => {
    setSlots(null);
    if (!LIVE) { setSlots(demoSlots(date)); return; }
    if (svc) bookingApi.slots(b.shop.handle, svc.id, date).then(r => setSlots(r.slots)).catch(() => setSlots([]));
  }, [b.shop.handle, svc, date]);
  const days = Array.from({ length: 21 }, (_, i) => new Date(Date.now() + i * DAY));
  return (
    <div className="bf-resched">
      <div className="bf-step">Pick a new time</div>
      <div className="bf-days">
        {days.map(d => { const k = ymd(d); return <button type="button" key={k} className={'bf-day' + (k === date ? ' on' : '')} style={k === date ? { background: c.accent, borderColor: c.accent, color: c.onAccent } : undefined} onClick={() => setDate(k)}>{d.toLocaleDateString('en-GB', { weekday: 'short' })}<b>{d.getDate()}</b></button>; })}
      </div>
      {slots === null ? <p className="bf-empty">Finding free times…</p> : slots.length === 0 ? <p className="bf-empty">No free times on this day.</p> : (
        <div className="bf-slots">{slots.map(t => <button type="button" key={t} disabled={busy} className="bf-slot" onClick={() => onPick(t)}>{hm(t, b.timezone)}</button>)}</div>
      )}
    </div>
  );
}
