import { useState } from 'react';
import { useStore } from '../store';
import { DeleteAccount } from './DeleteAccount';
import { VerifyStatus } from './Verify';
import { goToSide } from '../side';

const SITE = 'https://app.aquenora.com';

/** Account settings: who's logged in, help links, and (at the very bottom) deleting the account. */
export function Settings() {
  const { s, h1Size, shopNameShown, storeUrl, live, logOut, deleteAccount, setListed } = useStore();
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <div className="home-head">
        <h1 className="h1" style={{ fontSize: h1Size }}>Settings</h1>
      </div>

      <section className="card money-card" aria-labelledby="set-account">
        <h2 id="set-account" className="card-title">Account</h2>
        <dl className="set-list">
          <div className="set-row"><dt>Shop</dt><dd>{shopNameShown}</dd></div>
          <div className="set-row"><dt>Store link</dt><dd>{storeUrl.replace(/^https?:\/\//, '')}</dd></div>
          {s.email && <div className="set-row"><dt>Email</dt><dd>{s.email}</dd></div>}
        </dl>
        {live && (
          <div className="ob-actions">
            <button type="button" className="btn-sm pickup-edit" onClick={() => logOut()}>Log out</button>
          </div>
        )}
      </section>

      {(live || s.verification !== 'verified') && (
        <section className="card money-card" aria-labelledby="set-verify">
          <h2 id="set-verify" className="card-title">Verification</h2>
          <VerifyStatus />
        </section>
      )}

      <section className="card money-card" aria-labelledby="set-shop">
        <h2 id="set-shop" className="card-title">AQUENORA shopping</h2>
        <label className="set-switch">
          <span>
            <b>Show my store in AQUENORA search</b>
            <small>Shoppers can find your products when they search the AQUENORA app. Only products with a photo and in stock are shown.</small>
          </span>
          <input type="checkbox" role="switch" checked={s.listed} onChange={e => setListed(e.target.checked)} />
          <span className="set-switch-ui" aria-hidden="true" />
        </label>
        <nav className="set-links">
          <button type="button" className="set-link-btn" onClick={() => goToSide('shop')}>Switch to shopping<span>›</span></button>
        </nav>
      </section>

      <section className="card money-card" aria-labelledby="set-help">
        <h2 id="set-help" className="card-title">Help</h2>
        <nav className="set-links">
          <a href={`${SITE}/support`} target="_blank" rel="noopener">Support and contact<span>›</span></a>
          <a href={`${SITE}/privacy`} target="_blank" rel="noopener">Privacy policy<span>›</span></a>
        </nav>
      </section>

      {live && (
        <section className="card money-card danger-card" aria-labelledby="set-danger">
          <h2 id="set-danger" className="card-title">Delete account</h2>
          <p>Permanently delete your AQUENORA account and take your store offline. This can't be undone.</p>
          <div className="ob-actions">
            <button type="button" className="btn-sm del-open" onClick={() => setDeleting(true)}>Delete account…</button>
          </div>
        </section>
      )}

      {deleting && <DeleteAccount storeUrl={storeUrl} onDelete={deleteAccount} onClose={() => setDeleting(false)} />}
    </>
  );
}
