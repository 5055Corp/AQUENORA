import { useState, type FormEvent } from 'react';
import { useStore } from '../store';
import { Logo } from './Logo';
import { AccountLogin } from '../account/AccountLogin';
import { goToSide } from '../side';

/**
 * Seller log-in (live mode): the one AQUENORA login, with "Log in to my seller store" switched on.
 * Switching it off logs in to shopping instead.
 */
export function Auth() {
  const { s } = useStore();
  return (
    <AccountLogin
      startSeller
      initialMode={s.authMode === 'signup' ? 'signup' : 'login'}
      notice={s.authError}
      onBack={() => goToSide('shop')}
      onShopper={() => goToSide('shop')}
      // The login is saved; reopening the seller side loads the store (or starts setup for a new one).
      onSeller={() => goToSide('sell')}
    />
  );
}

/** Shown while a saved login loads the store, or if loading failed. */
export function Loading() {
  const { s, retryLoad, logOut } = useStore();
  return (
    <>
      <div className="ob-top">
        <Logo style={{ fontSize: 20 }} />
      </div>
      <div className="loading" role="status">
        {s.loadError ? (
          <>
            <p>{s.loadError}</p>
            <div className="ob-actions">
              <button type="button" className="btn-dark ob-next" onClick={retryLoad}>Try again</button>
            </div>
            <button type="button" className="ob-skip" onClick={() => logOut()}>Log out</button>
          </>
        ) : (
          <p>Opening your store…</p>
        )}
      </div>
    </>
  );
}

/** Signing in on a new phone or computer: enter the 6-digit code AQUENORA emailed. */
export function DeviceCode() {
  const { s, confirmDevice, resendDeviceCode, logOut } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code from the email.');
    setError(await confirmDevice(code));
  };
  return (
    <>
      <div className="ob-top">
        <Logo style={{ fontSize: 20 }} />
      </div>
      <form className="dc" onSubmit={submit}>
        <div className="dc-icon" aria-hidden="true">✉️</div>
        <h1 className="dc-title">Check your email</h1>
        <p className="dc-text">
          You're signing in on a new device. To keep your store safe, enter the 6-digit code we sent
          {s.deviceSentTo ? <> to <b>{s.deviceSentTo}</b></> : ''}.
        </p>
        <input
          className="field dc-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          aria-label="6-digit code"
          placeholder="••••••"
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
        />
        {(error || s.deviceError) && <div className="form-error" role="alert">{error || s.deviceError}</div>}
        <button type="submit" className="btn-dark dc-go" disabled={s.busy || code.length !== 6}>{s.busy ? 'Checking…' : 'Confirm'}</button>
        <button type="button" className="link-btn dc-link" onClick={() => { resendDeviceCode(); setResent(true); setError(''); }}>
          {resent ? 'Sent again. Check your spam folder too.' : "Didn't get it? Send a new code"}
        </button>
        <p className="dc-note">You only do this once on each device. Not you? Change your password and write to support@aquenora.com.</p>
        <button type="button" className="ob-skip" onClick={() => logOut()}>Log out</button>
      </form>
    </>
  );
}
