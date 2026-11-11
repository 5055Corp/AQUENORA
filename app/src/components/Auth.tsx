import type { FormEvent } from 'react';
import { useStore } from '../store';
import { TAGLINE } from '../brand';

/** Sign up / log in (live mode only). Styled like the setup steps. */
export function Auth() {
  const { s, set, submitAuth, isMobile, h1Size } = useStore();
  const signup = s.authMode === 'signup';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!s.busy) submitAuth();
  };

  return (
    <>
      <div className="ob-top">
        <div className="wordmark" style={{ fontSize: 20 }}>AQUENORA</div>
      </div>
      <div className="ob-body" style={{ gridTemplateColumns: 'minmax(0,1fr)', padding: isMobile ? '24px 20px 32px' : '48px 40px' }}>
        <form className="ob-main auth" onSubmit={submit} noValidate>
          <div className="ob-head">
            <h1 className="h1" style={{ fontSize: h1Size }}>{signup ? 'Open your free store' : 'Welcome back'}</h1>
            <p>{signup ? 'It takes about 5 minutes. No card needed.' : 'Log in to manage your store.'}</p>
          </div>

          <label className="ob-label">Email
            <input
              className="field ob-input"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={s.email}
              onChange={e => set({ email: e.target.value, authError: '' })}
              placeholder="you@example.com"
            />
          </label>
          <label className="ob-label">Password
            <input
              className="field ob-input"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={s.password}
              onChange={e => set({ password: e.target.value, authError: '' })}
              placeholder={signup ? 'At least 8 characters' : ''}
            />
          </label>

          {s.authError && <div className="form-error" role="alert">{s.authError}</div>}

          <div className="ob-actions">
            <button type="submit" className="btn-dark ob-next" disabled={s.busy} style={{ opacity: s.busy ? 0.6 : 1 }}>
              {s.busy ? 'Please wait…' : signup ? 'Create my store' : 'Log in'}
            </button>
          </div>
          <button
            type="button"
            className="ob-skip"
            onClick={() => set({ authMode: signup ? 'login' : 'signup', authError: '', password: '' })}
          >
            {signup ? 'Already have a store? Log in' : 'New to AQUENORA? Create a store'}
          </button>
          <p className="brand-line">{TAGLINE}</p>
        </form>
      </div>
    </>
  );
}

/** Shown while a saved login loads the store, or if loading failed. */
export function Loading() {
  const { s, retryLoad, logOut } = useStore();
  return (
    <>
      <div className="ob-top">
        <div className="wordmark" style={{ fontSize: 20 }}>AQUENORA</div>
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
