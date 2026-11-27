import { useRef, useState } from 'react';
import { buyerDisputeAction, buyerDisputeFileUrl, LIVE, openDispute, type Dispute, type DisputeReason, type PhotoFile } from '../api';
import { prepareImage } from '../images';

const REASONS: [DisputeReason, string][] = [
  ['not_arrived', "It hasn't arrived"],
  ['wrong_item', 'Wrong item'],
  ['damaged', 'Damaged'],
  ['not_as_described', 'Not as described'],
  ['other', 'Something else'],
];
const WHO = { buyer: 'You', seller: 'Shop', aquenora: 'AQUENORA' };

/** Up to 3 photos, shrunk in the browser. */
export function usePhotos() {
  const [photos, setPhotos] = useState<{ file: PhotoFile; url: string }[]>([]);
  const [error, setError] = useState('');
  const add = async (files: FileList | null) => {
    setError('');
    for (const f of Array.from(files ?? []).slice(0, 3 - photos.length)) {
      try {
        const img = await prepareImage(f, 'product');
        setPhotos(p => [...p, { file: { mime_type: img.mimeType, data: img.base64 }, url: img.dataUrl }].slice(0, 3));
      } catch {
        setError('Could not use that photo. Try another one.');
      }
    }
  };
  return { photos, add, remove: (i: number) => setPhotos(p => p.filter((_, n) => n !== i)), clear: () => setPhotos([]), error };
}

export function PhotoPicker({ p, ink, label = 'Photos (optional)' }: { p: ReturnType<typeof usePhotos>; ink: string; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="pb-photos">
      <span className="pb-label">{label}</span>
      <div className="pb-row">
        {p.photos.map((ph, i) => (
          <button key={i} type="button" className="pb-thumb" onClick={() => p.remove(i)} aria-label={`Remove photo ${i + 1}`}>
            <img src={ph.url} alt="" /><span>×</span>
          </button>
        ))}
        {p.photos.length < 3 && (
          <button type="button" className="pb-add" style={{ borderColor: ink + '44', color: ink }} onClick={() => input.current?.click()} aria-label="Add a photo">+</button>
        )}
      </div>
      {p.error && <small className="pb-error">{p.error}</small>}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={e => { p.add(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

const statusLine = (d: Dispute, shop: string, money: (n: number) => string) => {
  const due = new Date(d.reply_by).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  switch (d.status) {
    case 'open': return `${shop} has until ${due} to reply.`;
    case 'replied': return `${shop} replied. If you can't agree, you can ask AQUENORA to help.`;
    case 'refunded': return `${shop} says they've sent back ${money(d.refund?.amount ?? 0)}. Check your account, then confirm below.`;
    case 'escalated': return d.decision?.outcome === 'refund_required'
      ? `AQUENORA has asked ${shop} to refund you ${money(d.decision.amount ?? 0)}.`
      : 'The AQUENORA team is looking at this and will decide soon.';
    default: return 'This problem is closed.';
  }
};

/** "Problem with your order?" on the tracking page: report it, then follow the conversation. */
export function ProblemPanel({ token, initial, shop, accent, accentText, ink, card, money }: {
  token: string;
  initial: Dispute | null;
  shop: string;
  accent: string;
  accentText: string;
  ink: string;
  card: string;
  money: (n: number) => string;
}) {
  const [dispute, setDispute] = useState<Dispute | null>(initial);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DisputeReason | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const photos = usePhotos();

  const run = async (fn: () => Promise<{ dispute: Dispute }>) => {
    setBusy(true);
    setError('');
    try {
      setDispute((await fn()).dispute);
      setText('');
      photos.clear();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
    setBusy(false);
  };
  // Demo store: no backend, so show what would happen.
  const demo = (d: Partial<Dispute>) => async () => ({ dispute: { ...(dispute ?? { id: 'demo', order_id: 'demo', order_display_id: 1051, reason: reason ?? 'other', reason_label: '', messages: [], refund: null, decision: null, reply_by: new Date(Date.now() + 2 * 86400000).toISOString(), can_escalate: false }), ...d } as Dispute });

  const send = () => {
    if (!reason) return setError('Choose what happened.');
    if (text.trim().length < 3) return setError('Tell the shop what happened.');
    const files = photos.photos.map(p => p.file);
    run(LIVE ? () => openDispute(token, { reason, message: text.trim(), ...(files.length ? { files } : {}) })
      : demo({ status: 'open', messages: [{ from: 'buyer', text: text.trim(), at: new Date().toISOString() }] }));
  };
  const act = (action: 'message' | 'confirm' | 'escalate') => {
    if (action === 'message' && !text.trim()) return setError('Write a message.');
    const files = photos.photos.map(p => p.file);
    run(LIVE ? () => buyerDisputeAction(token, { action, ...(text.trim() ? { text: text.trim() } : {}), ...(files.length ? { files } : {}) })
      : demo(action === 'confirm' ? { status: 'resolved' } : action === 'escalate' ? { status: 'escalated' } : { messages: [...(dispute?.messages ?? []), { from: 'buyer', text: text.trim(), at: new Date().toISOString() }] }));
  };

  if (!dispute) {
    return (
      <section className="pb" style={{ background: card }}>
        {!open ? (
          <button type="button" className="pb-open" style={{ color: ink }} onClick={() => setOpen(true)}>Problem with your order?</button>
        ) : (
          <>
            <h2>Problem with your order?</h2>
            <span className="pb-label">What happened?</span>
            <div className="pb-chips" role="radiogroup" aria-label="What happened">
              {REASONS.map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={reason === k} className="pb-chip"
                  style={reason === k ? { background: ink, color: card, borderColor: ink } : { borderColor: ink + '33', color: ink }} onClick={() => setReason(k)}>{l}</button>
              ))}
            </div>
            <label className="pb-text"><span className="pb-label">Tell the shop more</span>
              <textarea rows={3} maxLength={1000} value={text} onChange={e => setText(e.target.value)} style={{ color: ink, borderColor: ink + '33' }} />
            </label>
            <PhotoPicker p={photos} ink={ink} />
            {error && <p className="pb-error" role="alert">{error}</p>}
            <button type="button" className="pb-send" disabled={busy} style={{ background: accent, color: accentText }} onClick={send}>{busy ? 'Sending…' : `Send to ${shop}`}</button>
            <p className="pb-note">The shop has 2 working days to reply. If you can't agree, AQUENORA steps in.</p>
          </>
        )}
      </section>
    );
  }

  const closed = dispute.status === 'resolved';
  return (
    <section className="pb" style={{ background: card }}>
      <h2>Your problem: {dispute.reason_label || REASONS.find(r => r[0] === dispute.reason)?.[1]}</h2>
      <p className="pb-status" style={{ borderColor: accent }}>{statusLine(dispute, shop, money)}</p>
      <ol className="pb-thread">
        {dispute.messages.map((m, i) => (
          <li key={i} className={'pb-msg ' + m.from}>
            <b>{WHO[m.from]}</b> {m.text}
            {!!m.files?.length && LIVE && (
              <span className="pb-msg-photos">{m.files.map(f => <a key={f} href={buyerDisputeFileUrl(token, f)} target="_blank" rel="noreferrer"><img src={buyerDisputeFileUrl(token, f)} alt="Photo" /></a>)}</span>
            )}
          </li>
        ))}
      </ol>
      {!closed && (
        <>
          {dispute.status === 'refunded' && (
            <button type="button" className="pb-send" disabled={busy} style={{ background: accent, color: accentText }} onClick={() => act('confirm')}>I got my refund</button>
          )}
          <label className="pb-text"><span className="pb-label">Add a message</span>
            <textarea rows={2} maxLength={1000} value={text} onChange={e => setText(e.target.value)} style={{ color: ink, borderColor: ink + '33' }} />
          </label>
          <PhotoPicker p={photos} ink={ink} />
          {error && <p className="pb-error" role="alert">{error}</p>}
          <div className="pb-actions">
            <button type="button" className="pb-ghost" disabled={busy} style={{ color: ink, borderColor: ink + '33' }} onClick={() => act('message')}>Send message</button>
            {dispute.can_escalate && dispute.status !== 'escalated' && (
              <button type="button" className="pb-ghost" disabled={busy} style={{ color: ink, borderColor: ink + '33' }} onClick={() => act('escalate')}>Ask AQUENORA to help</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
