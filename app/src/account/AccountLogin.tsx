import { useState, type FormEvent } from 'react';
import { Mark } from '../components/Logo';
import { TAGLINE } from '../brand';
import { requestPasswordReset, sellerAuth, shopperAuth, type Shopper } from './accountApi';
import '../shop/shop.css';

/**
 * One AQUENORA login. By default it logs in to shopping; the toggle at the bottom logs in to
 * the seller's store dashboard instead (or opens a new store when creating an account).
 */
export function AccountLogin({ startSeller, onShopper, onSeller, onBack, initialMode = 'login', notice = '' }: {
  startSeller: boolean;
  onShopper: (s: Shopper) => void;
  /** The seller login is saved; open the seller dashboard. */
  onSeller: () => void;
  onBack?: () => void;
  initialMode?: 'login' | 'signup';
  notice?: string;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [seller, setSeller] = useState(startSeller);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const signup = mode === 'signup';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return setError('Enter a valid email address.');
    if (mode === 'forgot') {
      setBusy(true);
      setError('');
      try {
        await requestPasswordReset(em);
        setSent(em);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
      setBusy(false);
      return;
    }
    if (!password) return setError('Enter your password.');
    if (signup && password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    setError('');
    try {
      if (seller) {
        await sellerAuth(em, password, signup);
        onSeller();
      } else {
        onShopper(await shopperAuth(em, password, signup, name));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  const title = mode === 'forgot' ? 'Forgot your password?' : signup ? (seller ? 'Open your free store' : 'Create your account') : 'Welcome back';
  const button = mode === 'forgot' ? 'Email me a reset link' : seller ? (signup ? 'Create my free store' : 'Log in to my store') : signup ? 'Create account' : 'Log in';

  return (
    <div className="acc">
      <header className="acc-top">
        {onBack && <button type="button" className="acc-back" onClick={onBack}>‹ Back to shopping</button>}
        <Mark size={72} ringColor="#CFC8DA" style={{ color: '#fff', margin: '4px auto 8px' }} />
        <div className="acc-name">AQUENORA</div>
        <div className="acc-motto">{TAGLINE.replace('. ', ' · ').replace(/\.$/, '').toUpperCase()}</div>
        <div className="acc-line">{seller ? 'Sell to Africa and the world.' : 'Discover African brands, delivered anywhere.'}</div>
      </header>

      <form className="acc-form" onSubmit={submit} noValidate>
        <h1>{title}</h1>
        {notice && !error && <p className="acc-notice" role="status">{notice}</p>}
        {sent ? (
          <>
            <p className="acc-sent" role="status">If there’s an AQUENORA account for <b>{sent}</b>, we’ve emailed a link to choose a new password. It works for 15 minutes.</p>
            <button type="button" className="acc-btn" onClick={() => { setSent(''); setMode('login'); }}>Back to log in</button>
          </>
        ) : (
          <>
            {mode === 'forgot' && <p className="acc-help">Enter your email and we’ll send you a link to choose a new password. It works for shopping and selling.</p>}
            {signup && (
              <label className="acc-label">Your name
                <input className="acc-input" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Amaka Obi" />
              </label>
            )}
            <label className="acc-label">Email
              <input className="acc-input" type="email" inputMode="email" autoComplete="email" value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="you@example.com" />
            </label>
            {mode !== 'forgot' && (
              <label className="acc-label">Password
                <span className="acc-pass">
                  <input className="acc-input" type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'}
                    value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder={signup ? 'At least 8 characters' : ''} />
                  <button type="button" className="acc-show" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
                </span>
              </label>
            )}
            {mode === 'login' && <button type="button" className="acc-forgot" onClick={() => { setMode('forgot'); setError(''); }}>Forgot password?</button>}
            {error && <div className="acc-error" role="alert">{error}</div>}
            <button type="submit" className={'acc-btn' + (seller && mode !== 'forgot' ? ' acc-btn-seller' : '')} disabled={busy}>{busy ? 'Please wait…' : button}</button>
            <p className="acc-alt">
              {mode === 'forgot' ? (
                <button type="button" onClick={() => { setMode('login'); setError(''); }}>Back to log in</button>
              ) : signup ? (
                <>Already have an account? <button type="button" onClick={() => { setMode('login'); setError(''); }}>Log in</button></>
              ) : (
                <>New to AQUENORA? <button type="button" onClick={() => { setMode('signup'); setError(''); }}>Create an account</button></>
              )}
            </p>
          </>
        )}

        {mode !== 'forgot' && !sent && (
          <label className={'acc-toggle' + (seller ? ' on' : '')}>
            <span className="acc-toggle-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round"><path d="M3 8l2-5h10l2 5M3 8v9h14V8M3 8h14M8 17v-5h4v5" /></svg>
            </span>
            <span className="acc-toggle-txt">
              <b>{signup ? 'I want to sell on AQUENORA' : 'Log in to my seller store'}</b>
              <span>{seller ? (signup ? 'You’ll set up your free store next' : 'Goes straight to your store dashboard') : (signup ? 'Open a free store as well' : 'Skip shopping and go to your store')}</span>
            </span>
            <input type="checkbox" role="switch" checked={seller} onChange={e => setSeller(e.target.checked)} />
            <span className="acc-switch" aria-hidden="true" />
          </label>
        )}
      </form>
    </div>
  );
}
