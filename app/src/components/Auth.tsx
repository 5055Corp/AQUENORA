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
