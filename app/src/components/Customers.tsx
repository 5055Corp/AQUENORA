import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, type Audience, type Campaign, type Customer } from '../api';
import { demoCustomers, inAudience } from '../demo';
import { useStore } from '../store';
import { Help } from './Help';

const AUDIENCES: { key: Audience; label: string; hint: string }[] = [
  { key: 'all', label: 'Everyone', hint: 'all past buyers who said yes to emails' },
  { key: 'repeat', label: 'Regulars', hint: 'bought 2 or more times' },
  { key: 'lapsed', label: 'Come back', hint: 'no order in the last 60 days' },
];

function shortDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Customers() {
  const { s, set, live, products, fmt, h1Size, flash, isMobile } = useStore();
  const [liveData, setLiveData] = useState<{ customers: Customer[]; campaigns: Campaign[] } | null>(null);
  const [error, setError] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.customers(s.token), api.campaigns(s.token)])
      .then(([c, k]) => setLiveData({ customers: c.customers, campaigns: k.campaigns }))
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load your customers.'));
  }, [s.token]);

  useEffect(() => {
    if (live) load();
  }, [live, load]);

  const demoList = useMemo(() => (live ? [] : demoCustomers(products)), [live, products]);
  const customers = live ? liveData?.customers ?? null : demoList;
  const campaigns = live ? liveData?.campaigns ?? [] : s.campaigns;
  const counts = useMemo(() => {
    const list = customers ?? [];
    return Object.fromEntries(AUDIENCES.map(a => [a.key, inAudience(list, a.key).length])) as Record<Audience, number>;
  }, [customers]);
  const reach = counts[audience] ?? 0;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || reach === 0 || sending) return;
    if (!window.confirm(`Send "${subject.trim()}" to ${reach} ${reach === 1 ? 'customer' : 'customers'}?`)) return;

    if (!live) {
      const c: Campaign = {
        id: 'demo-' + Date.now(), subject: subject.trim(), message: message.trim(), audience,
        recipient_count: reach, sent_count: reach, failed_count: 0, sent_at: new Date().toISOString(),
      };
      set({ campaigns: [c, ...s.campaigns] });
      setSubject('');
      setMessage('');
      flash('Demo: no real emails were sent');
      return;
    }

    setSending(true);
    try {
      const { campaign } = await api.sendCampaign(s.token, { audience, subject: subject.trim(), message: message.trim() });
      setSubject('');
      setMessage('');
      flash(`Sent to ${campaign.sent_count} ${campaign.sent_count === 1 ? 'customer' : 'customers'}`);
      load();
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const preview = message.replace(/\{name\}/gi, 'Ada');

  return (
    <>
      <div className="home-head">
        <h1 className="h1" style={{ fontSize: h1Size }}>Customers</h1>
        <p>Everyone who has bought from you. Email the ones who said yes to your news and offers.</p>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {!customers && !error && <div className="empty">Loading your customers…</div>}

      {customers && (
        <>
          <form className="card money-card campaign" onSubmit={send}>
            <h2 className="card-title">Send an email</h2>

            <div className="ctl">
              <div className="ctl-label">Who gets it</div>
              <div className="aud">
                {AUDIENCES.map(a => (
                  <button
                    type="button"
                    key={a.key}
                    aria-pressed={audience === a.key}
                    className="aud-opt"
                    style={{ borderColor: audience === a.key ? 'var(--ink)' : 'var(--line)', background: audience === a.key ? '#fff' : 'var(--tile)' }}
                    onClick={() => setAudience(a.key)}
                  >
                    <span>{a.label} <b>({counts[a.key]})</b></span>
                    <span>{a.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="ctl-input">Subject
              <input className="field" value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} placeholder="e.g. New indigo wraps just landed" />
            </label>
            <label className="ctl-input">Message
              <textarea
                className="field"
                rows={isMobile ? 5 : 6}
                value={message}
                maxLength={5000}
                onChange={e => setMessage(e.target.value)}
                placeholder={'Hi {name},\n\nOur new indigo wraps are in. Order this week for free delivery in Lagos.'}
              />
            </label>
            <div className="ctl-note">Write <code>{'{name}'}</code> and each customer sees their own first name. A “Visit the shop” button and an unsubscribe link are added for you.</div>

            {message.trim() && (
              <div className="preview-mail" aria-label="Preview">
                <div className="eyebrow">Preview</div>
                <strong>{subject.replace(/\{name\}/gi, 'Ada') || '(no subject)'}</strong>
                <p>{preview}</p>
              </div>
            )}

            <div className="ob-actions">
              <button type="submit" className="btn-dark ob-next" disabled={sending || reach === 0 || !subject.trim() || !message.trim()} style={{ opacity: sending || reach === 0 || !subject.trim() || !message.trim() ? 0.45 : 1 }}>
                {sending ? 'Sending…' : reach === 0 ? 'Nobody in this group yet' : `Send to ${reach} ${reach === 1 ? 'customer' : 'customers'}`}
              </button>
            </div>
            <Help
              id="consent"
              text="Only customers who ticked “Send me news and offers” when they paid get these emails, and each email has an unsubscribe link. That's the law in Nigeria, Ghana and South Africa, and it keeps your emails out of spam. You can send one email a day."
            />
          </form>

          {campaigns.length > 0 && (
            <section className="card money-card">
              <h2 className="card-title">Sent emails</h2>
              <ul className="sent">
                {campaigns.map(c => (
                  <li key={c.id}>
                    <div>
                      <strong>{c.subject}</strong>
                      <span>{shortDate(c.sent_at)} · {AUDIENCES.find(a => a.key === c.audience)?.label}</span>
                    </div>
                    <span className="pill" style={{ background: 'var(--go-soft)', color: 'var(--go-ink)' }}>
                      Sent to {c.sent_count}{c.failed_count ? `, ${c.failed_count} failed` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card money-card">
            <h2 className="card-title">Past buyers ({customers.length})</h2>
            {customers.length === 0 ? (
              <div className="empty">No customers yet. Everyone who buys from your shop will appear here.</div>
            ) : (
              <ul className="buyers">
                {customers.map(c => (
                  <li key={c.email}>
                    <div className="buyer-main">
                      <strong>{c.name ?? c.email}</strong>
                      <span>{c.name ? c.email : ''}</span>
                    </div>
                    <div className="buyer-stats">
                      <span>{c.orders} {c.orders === 1 ? 'order' : 'orders'} · {fmt(c.total_spent)}</span>
                      <span>Last: {shortDate(c.last_order_at)}</span>
                    </div>
                    <span className="pill" style={c.subscribed ? { background: 'var(--go-soft)', color: 'var(--go-ink)' } : { background: 'var(--chip)', color: 'var(--muted)' }}>
                      {c.subscribed ? 'Gets emails' : 'No emails'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {!live && <p className="demo-note">Demo: sample customers. Sending only pretends.</p>}
        </>
      )}
    </>
  );
}
