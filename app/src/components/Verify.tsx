import { useRef, useState, type ReactNode } from 'react';
import type { IdType, VerificationBody } from '../api';
import { prepareImage } from '../images';
import { useStore } from '../store';

type Doc = VerificationBody['documents'][number];

const ID_TYPES: [IdType, string][] = [
  ['nin', 'NIN slip / National ID'],
  ['drivers_licence', "Driver's licence"],
  ['passport', 'International passport'],
  ['voters_card', "Voter's card"],
  ['national_id', 'National ID card (other countries)'],
];

/** Shrinks a photo, or keeps a PDF as it is (CAC certificates are often PDFs). */
async function toDoc(file: File, kind: Doc['kind']): Promise<{ doc: Doc; preview: string | null }> {
  if (file.type === 'application/pdf') {
    if (file.size > 3 * 1024 * 1024) throw new Error('That PDF is too big. Use one under 3 MB, or a photo of the certificate.');
    const data = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] ?? '');
      fr.onerror = () => reject(new Error('Could not read the file.'));
      fr.readAsDataURL(file);
    });
    return { doc: { kind, mime_type: 'application/pdf', data }, preview: null };
  }
  const img = await prepareImage(file, 'product');
  return { doc: { kind, mime_type: img.mimeType, data: img.base64 }, preview: img.dataUrl };
}

function FilePick({ label, hint, kind, accept, capture, value, onChange }: {
  label: string;
  hint: string;
  kind: Doc['kind'];
  accept: string;
  capture?: 'user' | 'environment';
  value: { doc: Doc; preview: string | null } | null;
  onChange: (v: { doc: Doc; preview: string | null } | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onChange(await toDoc(file, kind));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that file. Try another one.');
    }
    setBusy(false);
  };
  return (
    <div className="vf-file">
      <div className="ctl-label">{label}</div>
      <button type="button" className={'vf-drop' + (value ? ' vf-drop-set' : '')} onClick={() => input.current?.click()} disabled={busy}>
        {value?.preview ? <img src={value.preview} alt="" /> : value ? <span className="vf-pdf">PDF added ✓</span> : <span>{busy ? 'Preparing…' : `+ ${capture === 'user' ? 'Take a selfie' : 'Add a photo or file'}`}</span>}
      </button>
      <div className="ctl-note">{value ? <button type="button" className="link-btn" onClick={() => input.current?.click()}>Change</button> : hint}</div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <input ref={input} type="file" accept={accept} capture={capture} hidden aria-label={label} onChange={e => pick(e.target.files?.[0])} />
    </div>
  );
}

/** "Verify your business": what AQUENORA checks before a new seller can take payments. */
export function VerifySheet({ onClose }: { onClose: () => void }) {
  const { s, submitVerification } = useStore();
  const [type, setType] = useState<'registered' | 'individual'>('registered');
  const [business, setBusiness] = useState(s.shopName);
  const [cac, setCac] = useState('');
  const [idType, setIdType] = useState<IdType>('nin');
  const [cert, setCert] = useState<{ doc: Doc; preview: string | null } | null>(null);
  const [idDoc, setIdDoc] = useState<{ doc: Doc; preview: string | null } | null>(null);
  const [selfie, setSelfie] = useState<{ doc: Doc; preview: string | null } | null>(null);
  const [socials, setSocials] = useState({ instagram: '', tiktok: '', facebook: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const docs = type === 'registered' ? [cert] : [idDoc, selfie];
    if (type === 'registered' && (!business.trim() || !cac.trim())) return setError('Add your registered business name and CAC number.');
    if (type === 'registered' && !cert) return setError('Upload your CAC certificate.');
    if (type === 'individual' && (!idDoc || !selfie)) return setError('Add a photo of your ID and a selfie.');
    if (type === 'individual' && !socials.instagram.trim() && !socials.tiktok.trim() && !socials.facebook.trim()) return setError('Add at least one social media page where you sell.');
    setBusy(true);
    setError('');
    const msg = await submitVerification({
      type,
      ...(type === 'registered' ? { business_name: business.trim(), cac_number: cac.trim() } : { id_type: idType }),
      socials: Object.fromEntries(Object.entries(socials).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])),
      documents: docs.filter((d): d is { doc: Doc; preview: string | null } => !!d).map(d => d.doc),
    });
    setBusy(false);
    if (msg) setError(msg);
    else onClose();
  };

  const social = (key: keyof typeof socials, label: string, ph: string) => (
    <label className="ob-label">{label}
      <input className="field ob-input" value={socials[key]} placeholder={ph} autoCapitalize="none" autoCorrect="off"
        onChange={e => setSocials(v => ({ ...v, [key]: e.target.value }))} />
    </label>
  );

  return (
    <div className="sheet-overlay vf-overlay" role="dialog" aria-modal="true" aria-labelledby="vf-title">
      <div className="vf-card">
        <div className="vf-head">
          <h2 id="vf-title">Verify your business</h2>
          <button type="button" className="vf-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <p className="vf-why">To keep AQUENORA safe for buyers, we check every new seller before they can take payments. It usually takes <b>1 working day</b>. Your documents are private: only the AQUENORA team sees them.</p>
        {s.verification === 'rejected' && s.verifyReason && (
          <div className="vf-rejected" role="alert"><b>Last time we couldn't verify you:</b> {s.verifyReason}</div>
        )}

        <div className="vf-choice" role="radiogroup" aria-label="Is your business registered?">
          <Choice on={type === 'registered'} onClick={() => setType('registered')} title="My business is registered" sub="With the CAC (RC or BN number)" />
          <Choice on={type === 'individual'} onClick={() => setType('individual')} title="Not registered yet" sub="Use a government ID and your social pages" />
        </div>

        {type === 'registered' ? (
          <>
            <label className="ob-label">Business name (as on your CAC certificate)
              <input className="field ob-input" value={business} onChange={e => setBusiness(e.target.value)} />
            </label>
            <label className="ob-label">CAC number
              <input className="field ob-input" value={cac} placeholder="e.g. RC1234567 or BN1234567" autoCapitalize="characters" onChange={e => setCac(e.target.value)} />
            </label>
            <FilePick label="CAC certificate" hint="A clear photo, or the PDF." kind="cac" accept="image/*,application/pdf" value={cert} onChange={setCert} />
          </>
        ) : (
          <>
            <label className="ob-label">Type of ID
              <select className="field ob-input" value={idType} onChange={e => setIdType(e.target.value as IdType)}>
                {ID_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <div className="vf-two">
              <FilePick label="Photo of your ID" hint="All four corners showing, no glare." kind="id" accept="image/*" capture="environment" value={idDoc} onChange={setIdDoc} />
              <FilePick label="Selfie" hint="Your face clearly, so we can match it to the ID." kind="selfie" accept="image/*" capture="user" value={selfie} onChange={setSelfie} />
            </div>
          </>
        )}

        <div className="vf-socials">
          <div className="ctl-label">Where do you sell online?{type === 'individual' ? ' (at least one)' : ' (optional)'}</div>
          {social('instagram', 'Instagram', '@yourshop')}
          {social('tiktok', 'TikTok', '@yourshop')}
          {social('facebook', 'Facebook page', 'yourshop')}
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="vf-actions">
          <button type="button" className="btn-sm pickup-edit" onClick={onClose} disabled={busy}>Later</button>
          <button type="button" className="btn-dark" onClick={send} disabled={busy}>{busy ? 'Sending…' : 'Send for checking'}</button>
        </div>
      </div>
    </div>
  );
}

function Choice({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} className={'vf-opt' + (on ? ' on' : '')} onClick={onClick}>
      <span className="vf-dot" aria-hidden="true" />
      <span><b>{title}</b><small>{sub}</small></span>
    </button>
  );
}

/** Where a seller's verification stands, with the button to start (or redo) it. */
export function VerifyStatus({ compact, children }: { compact?: boolean; children?: ReactNode }) {
  const { s, live } = useStore();
  const [open, setOpen] = useState(false);
  if (!live && s.verification === 'verified') return null;
  const st = s.verification;
  if (st === 'verified') {
    return compact ? null : (
      <div className="vf-status vf-ok"><b>✓ Verified seller</b><span>Buyers see the Verified seller badge on your store.</span></div>
    );
  }
  return (
    <div className={'vf-status' + (st === 'pending' ? ' vf-wait' : ' vf-todo')}>
      {st === 'pending' ? (
        <>
          <b>We're checking your business</b>
          <span>You'll get an email when it's done, usually within 1 working day. Until then you can keep building your store.</span>
        </>
      ) : (
        <>
          <b>{st === 'rejected' ? "We couldn't verify you yet" : 'Verify your business to start taking payments'}</b>
          <span>{st === 'rejected' && s.verifyReason ? s.verifyReason : 'A quick check that keeps AQUENORA safe for buyers. Takes about 2 minutes.'}</span>
          <button type="button" className="btn-dark btn-sm" onClick={() => setOpen(true)}>{st === 'rejected' ? 'Try again' : 'Verify now'}</button>
        </>
      )}
      {children}
      {open && <VerifySheet onClose={() => setOpen(false)} />}
    </div>
  );
}
