import { useState, type FormEvent } from 'react';
import { Mark } from '../components/Logo';
import { setNewPassword } from './accountApi';
import '../shop/shop.css';

/** app.aquenora.com/reset-password?token=…&email=…: the link in the password reset email. */
export function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    setError('');
    try {
      await setNewPassword(token, password);
      setDone(true);
    } catch {
      setError('This link has expired or was already used. Ask for a new one from the log-in page.');
    }
    setBusy(false);
  };

  return (
    <div className="acc">
      <header className="acc-top">
        <Mark size={64} ringColor="#CFC8DA" style={{ color: '#fff', margin: '4px auto 8px' }} />
        <div className="acc-name">AQUENORA</div>
      </header>
      <form className="acc-form" onSubmit={submit} noValidate>
        <h1>{done ? 'Password changed' : 'Choose a new password'}</h1>
        {done ? (
          <>
            <p className="acc-help">Your new password works for shopping and for your store. Log in with it in the AQUENORA app or at app.aquenora.com.</p>
            <a className="acc-btn" href="/" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Log in</a>
          </>
        ) : !token ? (
          <p className="acc-error">This link isn’t complete. Open it again from the email, or ask for a new one from the log-in page.</p>
        ) : (
          <>
            {email && <p className="acc-help">For {email}</p>}
            <label className="acc-label">New password
              <span className="acc-pass">
                <input className="acc-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="At least 8 characters" />
                <button type="button" className="acc-show" onClick={() => setShow(v => !v)}>{show ? 'Hide' : 'Show'}</button>
              </span>
            </label>
            {error && <div className="acc-error" role="alert">{error}</div>}
            <button type="submit" className="acc-btn" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
          </>
        )}
      </form>
    </div>
  );
}
