// The Business tab: running, promoting and growing the business. Store design lives here too.
// Booking tools only show for service providers (bookings switched on).
import { useEffect, useState, type ReactNode } from 'react';
import { api, type Audience, type CampaignSchedule, type EmailAllowance } from '../api';
import { IOS_APP, SELL_PRO_HERE, shareLink } from '../native';
import { useStore } from '../store';
import { InviteCard } from './InviteCard';
import { BookingEmailEditor, ServicesAndHours } from './BusinessBookings';

type View = 'hub' | 'blasts' | 'auto' | 'share' | 'services' | 'invite';

/** The booking page: <shop>/book, or ?shop=x&book=1 before the shop has its own address. */
export const bookingUrl = (storeUrl: string) => (storeUrl.includes('?') ? `${storeUrl}&book=1` : `${storeUrl.replace(/\/$/, '')}/book`);

import { defaultBookingSettings } from '../bookings';
export { defaultBookingSettings };

/** Thin line icons, the same style as the menu. */
export const ICON: Record<string, ReactNode> = {
  bookings: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" /></>,
  link: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" /></>,
  mega: <><path d="M3 11v3a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z" /><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5L12 13l8.5-6.5" /></>,
  design: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8S10.5 3 8 3.8 8.5 8 12 8zm0 0s1.5-5 4-4.2S15.5 8 12 8z" /></>,
};
export const Icon = ({ k, size = 22 }: { k: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[k]}</svg>
);

function Row({ icon, title, sub, onClick, right, children }: { icon: string; title: string; sub: string; onClick: () => void; right?: ReactNode; children?: ReactNode }) {
  return (
    <button type="button" className="biz-row" onClick={onClick}>
      <span className="biz-ic"><Icon k={icon} /></span>
      <span className="biz-row-text"><b>{title}</b><small>{sub}</small>{children}</span>
      {right ?? <span className="biz-chev" aria-hidden="true">›</span>}
    </button>
  );
}

export function Business() {
  const { s, set, h1Size, live, storeUrl, saveBookings, flash } = useStore();
  const [view, setView] = useState<View>('hub');
  const [allowance, setAllowance] = useState<EmailAllowance | null>(live ? null : DEMO_ALLOWANCE);
  const bookingsOn = !!s.bookings?.enabled;

  useEffect(() => {
    if (live && s.token) api.emailAllowance(s.token).then(r => setAllowance(r.allowance)).catch(() => {});
  }, [live, s.token, view]);
  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const back = <button type="button" className="biz-back" onClick={() => setView('hub')}>‹ Business</button>;
  if (view === 'blasts') return <>{back}<EmailBlasts allowance={allowance} /></>;
  if (view === 'auto') return <>{back}<BookingEmailEditor /></>;
  if (view === 'services') return <>{back}<ServicesAndHours /></>;
  if (view === 'share') return <>{back}<ShareStore /></>;
  if (view === 'invite') return <>{back}<h1 className="h1" style={{ fontSize: h1Size }}>Invite a seller</h1><InviteCard /></>;

  const used = allowance ? allowance.used_this_month / Math.max(1, allowance.free_per_month) : 0;
  const bookLink = bookingUrl(storeUrl).replace(/^https?:\/\//, '');
  const turnOn = async () => {
    const err = await saveBookings({ ...(s.bookings ?? defaultBookingSettings(s.country)), enabled: true });
    if (err) flash(err);
    else { flash('Bookings are on. Add your services.'); setView('services'); }
  };

  return (
    <div className="biz">
      <h1 className="h1" style={{ fontSize: h1Size }}>Business</h1>
      <p className="biz-sub">{bookingsOn ? 'Run, promote and grow your business.' : 'Promote and grow your business.'}</p>

      {bookingsOn ? (
        <div className="biz-hero">
          <span className="biz-hero-ic"><Icon k="bookings" /></span>
          <span><b>Your bookings</b><small>See today, add a walk-in or phone booking</small></span>
          <button type="button" className="biz-hero-go" onClick={() => set({ tab: 'orders' })}>Open</button>
        </div>
      ) : (
        <div className="biz-hero">
          <span className="biz-hero-ic"><Icon k="mega" /></span>
          <span><b>Send an email blast</b><small>Tell your buyers about new arrivals</small></span>
          <button type="button" className="biz-hero-go" onClick={() => setView('blasts')}>Start</button>
        </div>
      )}

      {bookingsOn && (
        <>
          <h2 className="biz-sec">Bookings</h2>
          <div className="biz-list">
            <Row icon="bookings" title="Services & hours" sub="What customers can book, and when" onClick={() => setView('services')} />
            <Row icon="link" title="Booking link" sub={bookLink} onClick={() => setView('share')} />
          </div>
        </>
      )}

      <h2 className="biz-sec">Marketing</h2>
      <div className="biz-list">
        <Row icon="mega" title="Email blasts" sub={allowance ? `${allowance.used_this_month} of ${allowance.free_per_month} free emails used this month` : 'Templates and repeating emails'} onClick={() => setView('blasts')}>
          {allowance && <span className="biz-meter"><i style={{ width: `${Math.min(100, used * 100)}%` }} /></span>}
        </Row>
        {bookingsOn && <Row icon="mail" title="Booking emails" sub="The 'Appointment booked' email, in your words" onClick={() => setView('auto')} />}
      </div>

      <h2 className="biz-sec">Your store</h2>
      <div className="biz-list">
        <Row icon="design" title="Store design" sub="Colours, fonts, banner, logo" onClick={() => set({ tab: 'design', designed: true })} />
        <Row icon="share" title="Share my store" sub="Link, WhatsApp, Instagram" onClick={() => setView('share')} />
        <Row icon="gift" title={IOS_APP ? 'Invite other sellers' : 'Invite a seller'} sub={IOS_APP ? 'Send your link to sellers you know' : 'You both get a free Pro month'} onClick={() => setView('invite')} />
      </div>

      {!bookingsOn && (
        <>
          <h2 className="biz-sec">More</h2>
          <div className="biz-list">
            <Row icon="bookings" title="Offer services too?" sub="Turn on bookings (e.g. tailoring, fittings, styling)" onClick={turnOn} />
          </div>
        </>
      )}
    </div>
  );
}

const DEMO_ALLOWANCE: EmailAllowance = { free_per_month: 100, used_this_month: 62, free_left: 38, credits: 0, price_per_email: 20, currency_code: 'ngn', resets_at: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString() };

// ---------------- email blasts ----------------

type Template = { key: string; name: string; colour: string; subject: string; message: string };
const TEMPLATES: Template[] = [
  { key: 'holiday', name: 'Holiday special', colour: '#8a1f17', subject: 'Holiday treat: 15% off at {shop}', message: "Hi {name},\n\nIt's the season to shine! Get 15% off everything until 31 December.\n\nTap below to shop before your favourites sell out.\n\nWith love,\n{shop}" },
  { key: 'new', name: 'New arrivals', colour: '#3b1680', subject: 'Just in at {shop}', message: "Hi {name},\n\nWe've just added new pieces we think you'll love. Be one of the first to see them.\n\nSee you soon,\n{shop}" },
  { key: 'slots', name: 'Slots this week', colour: '#1e6b34', subject: 'A few spaces left this week', message: "Hi {name},\n\nWe have a few appointments left this week. Book yours before they go!\n\n{shop}" },
  { key: 'thanks', name: 'Thank you', colour: '#c45a37', subject: 'Thank you from {shop}', message: "Hi {name},\n\nThank you for shopping with us. It means a lot to a small business like ours.\n\nUntil next time,\n{shop}" },
];

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'repeat', label: 'Regulars' },
  { key: 'lapsed', label: 'Come back' },
];

function EmailBlasts({ allowance }: { allowance: EmailAllowance | null }) {
  const { s, live, h1Size, flash, shopNameShown, fmt, set } = useStore();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [repeat, setRepeat] = useState<'now' | 'week' | 'month'>('now');
  const [counts, setCounts] = useState<Record<Audience, number> | null>(live ? null : { all: 214, repeat: 61, lapsed: 48 });
  const [schedules, setSchedules] = useState<CampaignSchedule[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!live) return;
    api.customers(s.token).then(r => setCounts(r.audiences)).catch(() => {});
    api.schedules(s.token).then(r => setSchedules(r.schedules)).catch(() => {});
  }, [live, s.token]);

  const pick = (t: Template) => {
    setSubject(t.subject.replace(/\{shop\}/g, shopNameShown));
    setMessage(t.message.replace(/\{shop\}/g, shopNameShown));
  };
  const reach = counts?.[audience] ?? 0;
  const free = Math.min(reach, allowance?.free_left ?? 0);
  const paid = reach - free;
  const short = Math.max(0, paid - (allowance?.credits ?? 0));
  const cost = paid * (allowance?.price_per_email ?? 0);

  const send = async () => {
    if (!subject.trim() || !message.trim() || !reach || busy) return;
    setBusy(true);
    try {
      if (repeat === 'now') {
        if (!window.confirm(`Send "${subject.trim()}" to ${reach} customers now?`)) return;
        if (live) await api.sendCampaign(s.token, { audience, subject: subject.trim(), message: message.trim() });
        flash(live ? `Sent to ${reach} customers` : 'Demo: no real emails were sent');
      } else {
        const first = new Date(Date.now() + 3600000).toISOString();
        if (live) {
          const { schedule } = await api.addSchedule(s.token, { audience, subject: subject.trim(), message: message.trim(), every: repeat, first_send_at: first });
          setSchedules(x => [schedule, ...x]);
        } else {
          setSchedules(x => [{ id: 'demo' + Date.now(), subject: subject.trim(), message: message.trim(), audience, every: repeat, next_run_at: first, active: true, last_sent_at: null, last_error: null }, ...x]);
        }
        flash(`Saved: it goes out every ${repeat}, starting in an hour`);
      }
      setSubject('');
      setMessage('');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const buy = async () => {
    const count = Math.max(50, short);
    if (!SELL_PRO_HERE) return;
    try {
      const { payment_url } = await api.buyEmails(s.token, count, window.location.href.split('?')[0]);
      window.location.href = payment_url;
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not start the payment.');
    }
  };

  const toggle = async (sc: CampaignSchedule) => {
    try {
      const next = live ? (await api.setSchedule(s.token, sc.id, !sc.active)).schedule : { ...sc, active: !sc.active };
      setSchedules(x => x.map(y => (y.id === sc.id ? next : y)));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Could not change it.');
    }
  };
  const remove = async (sc: CampaignSchedule) => {
    if (!window.confirm(`Stop "${sc.subject}" for good?`)) return;
    if (live) await api.deleteSchedule(s.token, sc.id).catch(() => {});
    setSchedules(x => x.filter(y => y.id !== sc.id));
  };

  return (
    <div className="biz">
      <h1 className="h1" style={{ fontSize: h1Size }}>Email blasts</h1>
      {allowance && (
        <div className="card biz-card">
          <b>This month's emails</b>
          <span className="biz-meter big"><i style={{ width: `${Math.min(100, (allowance.used_this_month / Math.max(1, allowance.free_per_month)) * 100)}%` }} /></span>
          <div className="biz-mrow"><span><b>{allowance.used_this_month} of {allowance.free_per_month}</b> free emails used</span><span>Resets {new Date(allowance.resets_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span></div>
          <p className="biz-note">After {allowance.free_per_month}, each extra email is <b>{fmt(allowance.price_per_email)}</b>.{allowance.credits > 0 ? ` You have ${allowance.credits} bought emails.` : ''}</p>
        </div>
      )}

      <h2 className="biz-sec">Start from a template</h2>
      <div className="biz-tpls">
        {TEMPLATES.map(t => (
          <button type="button" key={t.key} className="biz-tpl" style={{ background: t.colour }} onClick={() => pick(t)}>
            <b>{t.name}</b><span>{t.subject.replace(/\{shop\}/g, shopNameShown)}</span>
          </button>
        ))}
      </div>

      <div className="card biz-card">
        <label className="biz-field"><span>Subject</span><input className="field" value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} placeholder="e.g. New arrivals this week" /></label>
        <label className="biz-field"><span>Message</span><textarea className="field" rows={7} maxLength={5000} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write {name} to use each customer's first name." /></label>
        <div className="biz-chips" role="group" aria-label="Who gets it">
          {AUDIENCES.map(a => (
            <button type="button" key={a.key} aria-pressed={audience === a.key} className={'biz-chip' + (audience === a.key ? ' on' : '')} onClick={() => setAudience(a.key)}>
              {a.label}{counts ? ` · ${counts[a.key]}` : ''}
            </button>
          ))}
        </div>
        <div className="biz-chips" role="group" aria-label="When">
          {(['now', 'week', 'month'] as const).map(r => (
            <button type="button" key={r} aria-pressed={repeat === r} className={'biz-chip' + (repeat === r ? ' on' : '')} onClick={() => setRepeat(r)}>
              {r === 'now' ? 'Send now' : r === 'week' ? 'Every week' : 'Every month'}
            </button>
          ))}
        </div>
        {reach > 0 && allowance && (
          <p className="biz-cost">{reach} emails: <b>{free} free</b>{paid > 0 ? <> + {paid} × {fmt(allowance.price_per_email)} = <b>{fmt(cost)}</b></> : ''}</p>
        )}
        {short > 0 && repeat === 'now' ? (
          SELL_PRO_HERE
            ? <button type="button" className="btn-dark biz-wide" onClick={buy}>Buy {Math.max(50, short)} emails to send this</button>
            : <p className="biz-note">You need {short} more emails. Buy them on app.aquenora.com, or choose a smaller group.</p>
        ) : (
          <button type="button" className="btn-dark biz-wide" disabled={busy || !subject.trim() || !message.trim() || !reach} onClick={send}>
            {busy ? 'Sending…' : repeat === 'now' ? `Send to ${reach} customers` : `Send every ${repeat}`}
          </button>
        )}
        <p className="biz-note center">Only customers who said yes to emails get it. Everyone can unsubscribe.</p>
      </div>

      {schedules.length > 0 && (
        <>
          <h2 className="biz-sec">Repeating</h2>
          <div className="biz-list">
            {schedules.map(sc => (
              <div className="biz-row static" key={sc.id}>
                <span className="biz-ic"><Icon k="mega" /></span>
                <span className="biz-row-text">
                  <b>{sc.subject}</b>
                  <small>Every {sc.every} · next {new Date(sc.next_run_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{sc.active ? '' : ' · paused'}</small>
                  {sc.last_error && <small className="biz-err">Last time: {sc.last_error}</small>}
                </span>
                <span className="biz-row-actions">
                  <button type="button" className="link-btn" onClick={() => toggle(sc)}>{sc.active ? 'Pause' : 'Restart'}</button>
                  <button type="button" className="link-btn" onClick={() => remove(sc)}>Stop</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <button type="button" className="link-btn biz-more" onClick={() => set({ tab: 'customers' })}>See all your buyers in Buyers ›</button>
    </div>
  );
}

// ---------------- share ----------------

function ShareStore() {
  const { s, storeUrl, h1Size, copyLink, shareWhatsApp, flash, shopNameShown } = useStore();
  const bookUrl = bookingUrl(storeUrl);
  const share = async (url: string, text: string) => {
    try { await shareLink(url, text); } catch { navigator.clipboard?.writeText(url).then(() => flash('Link copied')).catch(() => {}); }
  };
  return (
    <div className="biz">
      <h1 className="h1" style={{ fontSize: h1Size }}>Share my store</h1>
      <div className="card biz-card">
        <b>Your store link</b>
        <div className="biz-link">{storeUrl.replace(/^https?:\/\//, '')}</div>
        <div className="biz-btns">
          <button type="button" className="btn-dark" onClick={() => share(storeUrl, `Shop ${shopNameShown}:`)}>Share</button>
          <button type="button" className="btn-sm pickup-edit" onClick={shareWhatsApp}>WhatsApp</button>
          <button type="button" className="btn-sm pickup-edit" onClick={copyLink}>Copy</button>
        </div>
        <p className="biz-note">Put it in your Instagram and TikTok bio, and your WhatsApp status.</p>
      </div>
      {s.bookings?.enabled && (
        <div className="card biz-card">
          <b>Your booking link</b>
          <div className="biz-link">{bookUrl.replace(/^https?:\/\//, '')}</div>
          <div className="biz-btns">
            <button type="button" className="btn-dark" onClick={() => share(bookUrl, `Book with ${shopNameShown}:`)}>Share</button>
            <button type="button" className="btn-sm pickup-edit" onClick={() => navigator.clipboard?.writeText(bookUrl).then(() => flash('Booking link copied')).catch(() => {})}>Copy</button>
          </div>
          <p className="biz-note">Customers pick a service and a free time, and pay a deposit or in full.</p>
        </div>
      )}
    </div>
  );
}
