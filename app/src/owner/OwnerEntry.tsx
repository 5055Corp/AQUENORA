import { useEffect, useState } from 'react';
import { OwnerArea } from './Owner';
import { ownerSignIn, ownerToken } from './ownerApi';

// There is no owner button anywhere. Signing in on the normal login screen with AQUENORA's admin
// email and password opens the owner area; it stays open on this device until "Sign out".

const EVENT = 'aq-owner-changed';

/** True if this is an AQUENORA admin login (it's then saved on this device). */
export async function tryOwnerSignIn(email: string, password: string): Promise<boolean> {
  try {
    await ownerSignIn(email, password);
    return true;
  } catch {
    return false;
  }
}

export const openOwnerArea = () => window.dispatchEvent(new Event(EVENT));

/** Shows the owner area over everything while the owner is signed in on this device. */
export function OwnerGate({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(() => !!ownerToken());
  useEffect(() => {
    const update = () => setOn(!!ownerToken());
    window.addEventListener(EVENT, update);
    return () => window.removeEventListener(EVENT, update);
  }, []);
  if (!on) return <>{children}</>;
  return <OwnerArea onSignedOut={() => setOn(false)} />;
}
