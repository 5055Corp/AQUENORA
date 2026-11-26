import { useEffect, useRef, useState } from 'react';
import { OwnerArea, OwnerSignIn } from './Owner';
import { ownerToken } from './ownerApi';

const EVENT = 'aq-owner-changed';
const signedIn = () => !!ownerToken();

/** The dark "Owner" button (Home and Settings), shown only after the owner has signed in on this device. */
export function OwnerButton() {
  const [on, setOn] = useState(signedIn);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const update = () => { setOn(signedIn()); setOpen(signedIn() && sessionStorage.getItem('aq-owner-open') === '1'); sessionStorage.removeItem('aq-owner-open'); };
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, []);
  if (!on) return null;
  return (
    <>
      <button type="button" className="ow-entry" onClick={() => setOpen(true)}>
        <span className="ow-crown" aria-hidden="true">♛</span><span>AQUENORA owner</span><b aria-hidden="true">›</b>
      </button>
      {open && <OwnerArea onClose={() => setOpen(false)} onSignedOut={() => { setOpen(false); window.dispatchEvent(new Event(EVENT)); }} />}
    </>
  );
}

/** The app version at the bottom of Settings. Tapping it 5 times opens the owner sign-in (no one else sees it). */
export function VersionTap() {
  const taps = useRef<number[]>([]);
  const [signIn, setSignIn] = useState(false);
  const tap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < 2500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      if (signedIn()) { sessionStorage.setItem('aq-owner-open', '1'); window.dispatchEvent(new Event(EVENT)); } else setSignIn(true);
    }
  };
  return (
    <>
      <p className="set-version" onClick={tap}>AQUENORA · version 1.2</p>
      {signIn && (
        <OwnerSignIn
          onClose={() => setSignIn(false)}
          onDone={() => { setSignIn(false); sessionStorage.setItem('aq-owner-open', '1'); window.dispatchEvent(new Event(EVENT)); }}
        />
      )}
    </>
  );
}
