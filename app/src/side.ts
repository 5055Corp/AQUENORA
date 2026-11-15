// The app has two sides: Shop (everyone) and Sell (the seller dashboard). See main.tsx.
import { IOS_APP } from './native';

export type Side = 'shop' | 'sell';
const KEY = 'aquenora-side';

/** Which side to open: /shop on the web, else the last side used; the iPhone app starts on Shop. */
export function initialSide(): Side {
  if (typeof window === 'undefined') return 'sell';
  if (/^\/shop(\/|$)/.test(window.location.pathname)) return 'shop';
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'shop' || saved === 'sell') return saved;
  } catch {
    /* storage unavailable */
  }
  return IOS_APP ? 'shop' : 'sell';
}

/** Switches side (and remembers it). The root (main.tsx) listens and swaps the screen. */
export function goToSide(side: Side): void {
  try {
    localStorage.setItem(KEY, side);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent('aquenora-side', { detail: side }));
}
