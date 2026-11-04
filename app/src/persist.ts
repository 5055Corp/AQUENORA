// Saves the demo store in this browser (localStorage) so a refresh doesn't lose a seller's details.
// Everything is wrapped in try/catch: private browsing or blocked storage just means nothing is saved.

import { COUNTRIES, FONTS, STATUS, THEMES, ACCENTS, type Order, type Product } from './data';
import type { State } from './state';

const KEY = 'aqenora-demo-v1';

/** Keys not worth keeping across visits. */
const SKIP: (keyof State)[] = ['help', 'password', 'busy', 'authError', 'nameError', 'token'];

export function save(s: State) {
  try {
    const out: Partial<State> = { ...s };
    for (const k of SKIP) delete out[k];
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {
    /* storage unavailable */
  }
}

export function clear() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

// ---- Live mode: only the login token and a few things the backend doesn't store yet. ----

const LIVE_KEY = 'aqenora-live-v1';

export interface LiveSaved {
  token: string;
  /** Per-browser checklist progress the backend doesn't track yet. */
  paystack: boolean;
  shared: boolean;
  designed: boolean;
}

export function saveLive(v: LiveSaved | null) {
  try {
    if (v) localStorage.setItem(LIVE_KEY, JSON.stringify(v));
    else localStorage.removeItem(LIVE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function loadLive(): LiveSaved | null {
  try {
    const v = JSON.parse(localStorage.getItem(LIVE_KEY) ?? 'null');
    if (!v || typeof v.token !== 'string' || !v.token) return null;
    return { token: v.token, paystack: !!v.paystack, shared: !!v.shared, designed: !!v.designed };
  } catch {
    return null;
  }
}

const isProduct = (p: unknown): p is Product =>
  !!p && typeof p === 'object' && typeof (p as Product).name === 'string' &&
  typeof (p as Product).price === 'number' && typeof (p as Product).stock === 'number';

const isOrder = (o: unknown): o is Order =>
  !!o && typeof o === 'object' && typeof (o as Order).id === 'string' && typeof (o as Order).usd === 'number' &&
  (o as Order).status in STATUS;

/** Returns the saved state merged over `base`, keeping only values that are the right shape. */
export function load(base: State): State {
  let raw: unknown;
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return base;
    raw = JSON.parse(text);
  } catch {
    return base;
  }
  if (!raw || typeof raw !== 'object') return base;
  const saved = raw as Record<string, unknown>;
  const out: State = { ...base };
  const target = out as unknown as Record<string, unknown>;

  for (const k of Object.keys(base) as (keyof State)[]) {
    if (SKIP.includes(k) || !(k in saved)) continue;
    const v = saved[k];
    const b = base[k];
    if (k === 'products') {
      if (v === null || (Array.isArray(v) && v.every(isProduct))) target[k] = v;
    } else if (k === 'orders') {
      if (Array.isArray(v) && v.every(isOrder)) target[k] = v;
    } else if (typeof v === typeof b) {
      target[k] = v;
    }
  }

  // Values that index into lookup tables must be valid, or the UI would crash.
  if (!COUNTRIES.some(c => c.id === out.country)) out.country = base.country;
  if (!(out.theme in THEMES)) out.theme = base.theme;
  if (!(out.font in FONTS)) out.font = base.font;
  if (!Number.isInteger(out.accent) || !ACCENTS[out.accent]) out.accent = base.accent;
  if (!Number.isInteger(out.step) || out.step < 0 || out.step > 4) out.step = 0;
  if (out.screen !== 'onboarding' && out.screen !== 'app') out.screen = base.screen;
  if (out.authMode !== 'signup' && out.authMode !== 'login') out.authMode = base.authMode;
  if (!['home', 'orders', 'products', 'design'].includes(out.tab)) out.tab = base.tab;
  if (!['all', 'new', 'shipped', 'delivered'].includes(out.filter)) out.filter = 'all';
  if (out.pv !== 'phone' && out.pv !== 'desktop') out.pv = base.pv;
  return out;
}
