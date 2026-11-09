// A store's design: what the seller picks in "Your store's look" and what buyers see.
// Same shape as the backend's StoreDesignSchema (backend/apps/backend/src/modules/seller/design.ts).

import { ACCENTS, FONTS as LEGACY_FONTS, THEMES, type FontId, type ThemeId } from './data';

export type FontKey =
  | 'newsreader' | 'playfair' | 'dmserif' | 'lora'
  | 'manrope' | 'poppins' | 'nunito' | 'spacegrotesk'
  | 'fredoka' | 'josefin';

export interface StoreDesign {
  version: 1;
  colors: { background: string; text: string; accent: string; accent_text: string; card: string };
  fonts: { heading: FontKey; body: FontKey };
  header: { align: 'left' | 'center' };
  banner: { style: 'large' | 'slim' | 'none'; headline: string; subtext: string };
  products: { columns: 2 | 3 | 4; show_stock: boolean };
  shape: { corners: 'round' | 'soft' | 'square'; buttons: 'pill' | 'rounded' | 'square' };
  announcement: string;
  about: string;
  social: { instagram: string; whatsapp: string };
}

/** Google Fonts. `google` is the css2 family spec; only the fonts a store uses are loaded. */
export const STORE_FONTS: Record<FontKey, { label: string; family: string; kind: string; google: string }> = {
  newsreader: { label: 'Newsreader', family: "'Newsreader', serif", kind: 'Classic serif', google: 'Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600' },
  playfair: { label: 'Playfair', family: "'Playfair Display', serif", kind: 'Elegant serif', google: 'Playfair+Display:wght@400;600;700' },
  dmserif: { label: 'DM Serif', family: "'DM Serif Display', serif", kind: 'Bold serif', google: 'DM+Serif+Display' },
  lora: { label: 'Lora', family: "'Lora', serif", kind: 'Soft serif', google: 'Lora:wght@400;500;600' },
  manrope: { label: 'Manrope', family: "'Manrope', sans-serif", kind: 'Clean', google: 'Manrope:wght@400;500;600;700' },
  poppins: { label: 'Poppins', family: "'Poppins', sans-serif", kind: 'Round & modern', google: 'Poppins:wght@400;500;600;700' },
  nunito: { label: 'Nunito', family: "'Nunito', sans-serif", kind: 'Friendly', google: 'Nunito:wght@400;600;700' },
  spacegrotesk: { label: 'Space Grotesk', family: "'Space Grotesk', sans-serif", kind: 'Techy', google: 'Space+Grotesk:wght@400;500;700' },
  fredoka: { label: 'Fredoka', family: "'Fredoka', sans-serif", kind: 'Playful', google: 'Fredoka:wght@400;500;600' },
  josefin: { label: 'Josefin Sans', family: "'Josefin Sans', sans-serif", kind: 'Stylish', google: 'Josefin+Sans:wght@400;600;700' },
};
export const FONT_KEYS = Object.keys(STORE_FONTS) as FontKey[];

/** Loads Google Fonts on demand (one <link> per font, added once). */
export function loadFonts(keys: FontKey[]) {
  for (const k of new Set(keys)) {
    const font = STORE_FONTS[k];
    if (!font || document.querySelector(`link[data-font="${k}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.font = k;
    link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`;
    document.head.appendChild(link);
  }
}

// ---- colour helpers ----

export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21). Body text needs 4.5; large text and buttons 3. */
export function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Black or white, whichever reads better on this colour. */
export function readableOn(bg: string): string {
  return contrast('#ffffff', bg) >= contrast('#1c1a17', bg) ? '#ffffff' : '#1c1a17';
}

/** oklch() accents from the old picker, as hex (sRGB). */
const LEGACY_ACCENT_HEX = ['#c45a37', '#2f9156', '#4d6bd1', '#c54a7d'];

// ---- presets ----

export interface Preset { key: string; label: string; desc: string; colors: StoreDesign['colors']; fonts: StoreDesign['fonts'] }

export const PRESETS: Preset[] = [
  { key: 'harmattan', label: 'Harmattan', desc: 'Warm and calm', colors: { background: '#f7f1e8', text: '#2a211a', accent: '#c45a37', accent_text: '#ffffff', card: '#fffaf3' }, fonts: { heading: 'newsreader', body: 'manrope' } },
  { key: 'lagos', label: 'Lagos Night', desc: 'Dark and bold', colors: { background: '#16130f', text: '#f6efe4', accent: '#e0a43a', accent_text: '#16130f', card: '#221e19' }, fonts: { heading: 'dmserif', body: 'manrope' } },
  { key: 'savanna', label: 'Savanna', desc: 'Fresh and light', colors: { background: '#eef0e6', text: '#1f2a1c', accent: '#2f9156', accent_text: '#ffffff', card: '#ffffff' }, fonts: { heading: 'lora', body: 'nunito' } },
  { key: 'indigo', label: 'Adire Indigo', desc: 'Deep blue and crisp', colors: { background: '#eef1f8', text: '#16213e', accent: '#2c3e8f', accent_text: '#ffffff', card: '#ffffff' }, fonts: { heading: 'playfair', body: 'poppins' } },
  { key: 'kente', label: 'Kente Gold', desc: 'Rich and festive', colors: { background: '#fff8e6', text: '#2b1d0e', accent: '#1f7a3f', accent_text: '#ffffff', card: '#ffffff' }, fonts: { heading: 'josefin', body: 'poppins' } },
  { key: 'hibiscus', label: 'Hibiscus', desc: 'Soft and playful', colors: { background: '#fdf0f3', text: '#3a1626', accent: '#c54a7d', accent_text: '#ffffff', card: '#ffffff' }, fonts: { heading: 'fredoka', body: 'nunito' } },
  { key: 'minimal', label: 'Minimal', desc: 'Black and white', colors: { background: '#ffffff', text: '#111111', accent: '#111111', accent_text: '#ffffff', card: '#f4f4f4' }, fonts: { heading: 'spacegrotesk', body: 'manrope' } },
];

/** Suggested colours for the pickers (one tap), besides the free colour picker. */
export const SWATCHES = [
  '#ffffff', '#f7f1e8', '#fff8e6', '#eef0e6', '#eef1f8', '#fdf0f3', '#16130f', '#111111',
  '#c45a37', '#e0a43a', '#1f7a3f', '#2f9156', '#2c3e8f', '#4d6bd1', '#c54a7d', '#7a3db8',
];

export function defaultDesign(country = 'Nigeria'): StoreDesign {
  return {
    version: 1,
    colors: { ...PRESETS[0].colors },
    fonts: { ...PRESETS[0].fonts },
    header: { align: 'left' },
    banner: { style: 'large', headline: `New season, made in ${country}`, subtext: '' },
    products: { columns: 4, show_stock: false },
    shape: { corners: 'round', buttons: 'pill' },
    announcement: '',
    about: '',
    social: { instagram: '', whatsapp: '' },
  };
}

const LEGACY_FONT_MAP: Record<FontId, FontKey> = { classic: 'newsreader', modern: 'manrope', friendly: 'fredoka' };

/** Turns the old simple look (style, colour, lettering) into a full design, so existing stores keep their look. */
export function designFromLegacy(input: { theme?: ThemeId; accent?: number; font?: FontId; announce?: string | null; country?: string }): StoreDesign {
  const th = THEMES[input.theme ?? 'harmattan'] ?? THEMES.harmattan;
  const accent = LEGACY_ACCENT_HEX[input.accent ?? 0] ?? LEGACY_ACCENT_HEX[0];
  const d = defaultDesign(input.country);
  d.colors = { background: th.bg, text: th.ink, accent, accent_text: readableOn(accent), card: th.card };
  const heading = LEGACY_FONT_MAP[input.font ?? 'classic'] ?? 'newsreader';
  d.fonts = { heading, body: 'manrope' };
  d.announcement = input.announce ?? '';
  return d;
}

/**
 * Checks a design from the server or this browser's storage, keeping valid values and filling the
 * rest from `fallback`. Anything malformed can't break the page.
 */
export function normalizeDesign(raw: unknown, fallback: StoreDesign): StoreDesign {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Partial<StoreDesign>;
  const pick = <T,>(v: unknown, ok: (x: unknown) => boolean, f: T): T => (ok(v) ? (v as T) : f);
  const oneOf = (...xs: unknown[]) => (v: unknown) => xs.includes(v);
  const str = (max: number) => (v: unknown) => typeof v === 'string' && v.length <= max;
  const c = (r.colors ?? {}) as Partial<StoreDesign['colors']>;
  return {
    version: 1,
    colors: {
      background: pick(c.background, isHex, fallback.colors.background),
      text: pick(c.text, isHex, fallback.colors.text),
      accent: pick(c.accent, isHex, fallback.colors.accent),
      accent_text: pick(c.accent_text, isHex, fallback.colors.accent_text),
      card: pick(c.card, isHex, fallback.colors.card),
    },
    fonts: {
      heading: pick(r.fonts?.heading, v => FONT_KEYS.includes(v as FontKey), fallback.fonts.heading),
      body: pick(r.fonts?.body, v => FONT_KEYS.includes(v as FontKey), fallback.fonts.body),
    },
    header: { align: pick(r.header?.align, oneOf('left', 'center'), fallback.header.align) },
    banner: {
      style: pick(r.banner?.style, oneOf('large', 'slim', 'none'), fallback.banner.style),
      headline: pick(r.banner?.headline, str(80), fallback.banner.headline),
      subtext: pick(r.banner?.subtext, str(160), fallback.banner.subtext),
    },
    products: {
      columns: pick(r.products?.columns, oneOf(2, 3, 4), fallback.products.columns),
      show_stock: pick(r.products?.show_stock, v => typeof v === 'boolean', fallback.products.show_stock),
    },
    shape: {
      corners: pick(r.shape?.corners, oneOf('round', 'soft', 'square'), fallback.shape.corners),
      buttons: pick(r.shape?.buttons, oneOf('pill', 'rounded', 'square'), fallback.shape.buttons),
    },
    announcement: pick(r.announcement, str(120), fallback.announcement),
    about: pick(r.about, str(600), fallback.about),
    social: {
      instagram: pick(r.social?.instagram, v => typeof v === 'string' && /^[A-Za-z0-9._]{0,30}$/.test(v), fallback.social.instagram),
      whatsapp: pick(r.social?.whatsapp, v => typeof v === 'string' && /^\d{0,15}$/.test(v), fallback.social.whatsapp),
    },
  };
}

/** Pixel values for the corner and button choices. */
export const RADIUS = { round: 16, soft: 8, square: 0 } as const;
export const BUTTON_RADIUS = { pill: 999, rounded: 10, square: 0 } as const;

/** Kept for the editor's "accent name" line; colours are free now. */
export const ACCENT_NAMES = ACCENTS.map(a => a.name);
export { LEGACY_FONTS };
