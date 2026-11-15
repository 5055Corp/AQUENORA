import { useEffect, useRef, useState } from 'react';

/** Delete-account confirmation (Apple requires in-app account deletion). */
export function DeleteAccount({ storeUrl, onDelete, onClose }: {
  storeUrl: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const ready = typed.trim().toUpperCase() === 'DELETE';

  const go = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await onDelete();
    } catch {
      setError('Something went wrong. Please try again, or contact support.');
      setBusy(false);
    }
  };

  return (
    <div className="sheet-overlay del-overlay" role="dialog" aria-modal="true" aria-labelledby="del-title">
      <div className="del-card">
        <h2 id="del-title">Delete your account?</h2>
        <p>This can't be undone. When you delete your AQUENORA account:</p>
        <ul>
          <li>Your store at <strong>{storeUrl.replace(/^https?:\/\//, '')}</strong> goes offline straight away</li>
          <li>Your products, store design, customer list and login are deleted</li>
          <li>Any Pro plan stops and your saved card is removed. You won't be charged again</li>
          <li>Money already sent to your bank is not affected</li>
          <li>Records of past orders and payments are kept only as long as the law requires (for tax and refunds)</li>
        </ul>
        <label className="del-label" htmlFor="del-confirm">Type <strong>DELETE</strong> to confirm</label>
        <input
          id="del-confirm"
          ref={inputRef}
          className="del-input"
          value={typed}
          autoComplete="off"
          autoCapitalize="characters"
          onChange={e => setTyped(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') go(); if (e.key === 'Escape') onClose(); }}
        />
        {error && <p className="del-error" role="alert">{error}</p>}
        <div className="del-btns">
          <button type="button" className="btn-sm pickup-edit" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="btn-sm del-go" onClick={go} disabled={!ready || busy}>
            {busy ? 'Deleting…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  );
}
