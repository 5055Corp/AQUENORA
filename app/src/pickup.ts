// In-store pickup: the seller's shop address and opening hours. Same shape as the backend's
// PickupSchema (backend/apps/backend/src/modules/seller/pickup.ts).

import type { CountryId } from './data';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];
export const DAY_NAMES: Record<Day, string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

export interface Hours { open: string; close: string }

export interface Pickup {
  enabled: boolean;
  address: string;
  area: string;
  hours: Record<Day, Hours | null>;
  instructions: string;
}

export function defaultPickup(): Pickup {
  const weekday = { open: '09:00', close: '18:00' };
  return {
    enabled: false,
    address: '',
    area: '',
    hours: { mon: weekday, tue: weekday, wed: weekday, thu: weekday, fri: weekday, sat: { open: '10:00', close: '16:00' }, sun: null },
    instructions: '',
  };
}

const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Checks pickup settings from the server or this browser; anything malformed falls back to defaults. */
export function normalizePickup(raw: unknown): Pickup {
  const d = defaultPickup();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Pickup>;
  const hours = {} as Pickup['hours'];
  for (const day of DAYS) {
    const h = r.hours?.[day];
    hours[day] = h === null ? null : h && isTime(h.open) && isTime(h.close) && h.open < h.close ? { open: h.open, close: h.close } : d.hours[day];
  }
  return {
    enabled: r.enabled === true,
    address: typeof r.address === 'string' ? r.address.slice(0, 200) : '',
    area: typeof r.area === 'string' ? r.area.slice(0, 60) : '',
    hours,
    instructions: typeof r.instructions === 'string' ? r.instructions.slice(0, 300) : '',
  };
}

/** Hours from UTC of each seller country (no daylight saving in these countries). */
const UTC_OFFSET: Record<CountryId, number> = { NG: 1, GH: 0, ZA: 2, CI: 0, SN: 0, DI: 0 };

/** The day and "HH:MM" time right now at the shop. Sellers abroad: the buyer's own clock. */
export function shopNow(country: CountryId, now = new Date()): { day: Day; time: string } {
  const local = country === 'DI' ? now : new Date(now.getTime() + (UTC_OFFSET[country] ?? 0) * 3600000);
  const get = country === 'DI'
    ? { d: local.getDay(), h: local.getHours(), m: local.getMinutes() }
    : { d: local.getUTCDay(), h: local.getUTCHours(), m: local.getUTCMinutes() };
  const day = DAYS[(get.d + 6) % 7];
  return { day, time: `${String(get.h).padStart(2, '0')}:${String(get.m).padStart(2, '0')}` };
}

export function isOpenNow(p: Pickup, country: CountryId, now = new Date()): boolean {
  const { day, time } = shopNow(country, now);
  const h = p.hours[day];
  return !!h && time >= h.open && time < h.close;
}

/** "09:00" -> "9am", "17:30" -> "5:30pm". */
export function prettyTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
}

export function hoursText(h: Hours | null): string {
  return h ? `${prettyTime(h.open)} – ${prettyTime(h.close)}` : 'Closed';
}
