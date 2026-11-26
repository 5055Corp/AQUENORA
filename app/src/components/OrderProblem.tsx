import { useEffect, useState } from 'react';
import { api, LIVE, type Dispute } from '../api';
import { PhotoPicker, usePhotos } from '../storefront/ProblemPanel';
import { useStore } from '../store';

const WHO = { buyer: 'Buyer', seller: 'You', aquenora: 'AQUENORA' };

/** A dispute photo (needs the seller's login, so it's loaded as a blob). */
function DisputePhoto({ disputeId, file }: { disputeId: string; file: string }) {
  const { s } = useStore();
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!LIVE) return;
    let live = true;
    let made = '';
    api.disputeFile(s.token, disputeId, file).then(u => { made = u; if (live) setUrl(u); }).catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [s.token, disputeId, file]);
  return url ? <a href={url} target="_blank" rel="noreferrer"><img className="op-photo" src={url} alt="Buyer's photo" /></a> : <span className="op-photo op-photo-loading" />;
}

/** On an order with a reported problem: the conversation, Reply, and Mark as refunded. */
export function OrderProblem({ d, total }: { d: Dispute; total: number }) {
  const { disputeAction, fmt } = useStore();
  const [mode, setMode] = useState<'' | 'reply' | 'refund'>('');
  const [text, setText] = useState('');
  const [amount, setAmount] = useState(String(d.decision?.amount ?? total));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const proof = usePhotos();
  const due = new Date(d.reply_by).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const tag =
    d.status === 'open' ? `Problem reported · reply by ${due}` :
    d.status === 'replied' ? 'Problem · waiting for the buyer' :
    d.status === 'refunded' ? 'Refunded · waiting for the buyer to confirm' :
    d.status === 'escalated' ? (d.decision?.outcome === 'refund_required' ? `AQUENORA: refund ${fmt(d.decision.amount ?? 0)} by ${d.decision.due ? new Date(d.decision.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'soon'}` : 'AQUENORA is looking at this') :
    'Problem closed';

  const send = async () => {
    setError('');
    if (mode === 'reply' && !text.trim()) return setError('Write your reply.');
    if (mode === 'refund' && !(Number(amount) > 0)) return setError('Enter how much you sent back.');
    setBusy(true);
    const files = proof.photos.map(p => p.file);
    const msg = await disputeAction(d.id, mode === 'refund'
      ? { action: 'refunded', amount: Number(amount), ...(text.trim() ? { text: text.trim() } : {}), ...(files.length ? { files: files.slice(0, 1) } : {}) }
      : { action: 'message', text: text.trim(), ...(files.length ? { files } : {}) });
    setBusy(false);
    if (msg) return setError(msg);
    setMode('');
    setText('');
    proof.clear();
  };

  const closed = d.status === 'resolved';
  return (
    <div className={'op' + (closed ? ' op-closed' : '')}>
      <span className={'pill op-tag' + (d.status === 'open' || d.status === 'escalated' ? ' op-urgent' : '')}>{tag}</span>
      <ol className="op-thread">
        {d.messages.map((m, i) => (
          <li key={i} className={'op-msg ' + m.from}>
            <b>{WHO[m.from]}{m.from === 'buyer' && i === 0 ? ` · ${d.reason_label}` : ''}:</b> {m.text}
            {!!m.files?.length && <span className="op-photos">{m.files.map(f => <DisputePhoto key={f} disputeId={d.id} file={f} />)}</span>}
          </li>
        ))}
      </ol>
      {!closed && !mode && (
        <div className="op-actions">
          <button type="button" className="btn-dark btn-sm" onClick={() => setMode('reply')}>Reply to buyer</button>
          {d.status !== 'refunded' && <button type="button" className="btn-sm pickup-edit" onClick={() => setMode('refund')}>Mark as refunded</button>}
        </div>
      )}
      {mode && (
        <div className="op-form">
          {mode === 'refund' && (
            <>
              <p className="op-help">Send the money back to the buyer yourself (bank transfer), then record it here. The buyer will confirm they got it.</p>
              <label className="ob-label">Amount you sent back
                <input className="field ob-input" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
              </label>
            </>
          )}
          <label className="ob-label">{mode === 'refund' ? 'Note for the buyer (optional)' : 'Your reply'}
            <textarea className="field ob-input op-text" rows={3} maxLength={1000} value={text}
              placeholder={mode === 'refund' ? 'e.g. Sent to your GTBank account at 2pm' : 'e.g. So sorry! I can send the right size tomorrow, or refund you.'}
              onChange={e => setText(e.target.value)} />
          </label>
          <PhotoPicker p={proof} ink="#1c1a17" label={mode === 'refund' ? 'Proof of transfer (optional)' : 'Photos (optional)'} />
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="op-actions">
            <button type="button" className="btn-sm pickup-edit" onClick={() => setMode('')} disabled={busy}>Cancel</button>
            <button type="button" className="btn-dark btn-sm" onClick={send} disabled={busy}>{busy ? 'Sending…' : mode === 'refund' ? `Mark ${fmt(Number(amount) || 0)} refunded` : 'Send reply'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
