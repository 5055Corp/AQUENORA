import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { StoreProvider } from './store';
import { readSettings } from './settings';
import { startNative } from './native';
import { initialSide, type Side } from './side';
import { ShopApp } from './shop/ShopApp';
import { ResetPassword } from './account/ResetPassword';
import { OwnerGate } from './owner/OwnerEntry';

startNative();

/** Two sides in one app: Shop (everyone) and Sell (the seller dashboard). */
function Root() {
  const [side, setSide] = useState<Side>(initialSide);
  // Bumped on every switch so each side starts fresh (e.g. picks up a login just saved).
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    const onSide = (e: Event) => {
      setSide((e as CustomEvent<Side>).detail);
      setOpened(n => n + 1);
      window.scrollTo(0, 0);
    };
    window.addEventListener('aquenora-side', onSide);
    return () => window.removeEventListener('aquenora-side', onSide);
  }, []);

  if (window.location.pathname.startsWith('/reset-password')) return <ResetPassword />;
  if (side === 'shop') return <ShopApp key={opened} />;
  return (
    <StoreProvider key={opened} settings={readSettings()}>
      <App />
    </StoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OwnerGate>
      <Root />
    </OwnerGate>
  </StrictMode>,
);
