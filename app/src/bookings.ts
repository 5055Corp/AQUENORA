// Shared booking defaults (used by signup and the Business tab).
import type { BookingSettings, Day, TimeBlock } from './api';

const TIMEZONES: Record<string, string> = { NG: 'Africa/Lagos', GH: 'Africa/Accra', ZA: 'Africa/Johannesburg', CI: 'Africa/Abidjan', SN: 'Africa/Dakar', DI: 'Europe/London' };

/** Bookings switched on, Monday–Friday 9–6 and Saturday 10–4, in the seller's own time zone. */
export function defaultBookingSettings(country: string): BookingSettings {
  const day = [{ from: '09:00', to: '18:00' }];
  return {
    enabled: true, timezone: TIMEZONES[country] ?? 'Africa/Lagos', address: '',
    hours: { sun: [], mon: day, tue: day, wed: day, thu: day, fri: day, sat: [{ from: '10:00', to: '16:00' }] },
    buffer_min: 15, min_notice_min: 120, days_ahead: 60, cancel_hours: 24,
  };
}

export const WEEK: [Day, string][] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
const DAY_OF: Day[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Does a blocked time apply on this local date (YYYY-MM-DD)? Same rule as the server. */
export function blockOn(b: TimeBlock, date: string): boolean {
  if (date < b.date || (b.end_date && date > b.end_date)) return false;
  if (b.days) return b.days.includes(DAY_OF[new Date(`${date}T12:00:00`).getDay()]);
  return date <= (b.end_date ?? b.date);
}

/** How a block repeats, in words: "Every day", "Mon–Fri", "Tue, Thu", "Once". */
export function repeatLabel(b: TimeBlock): string {
  if (!b.days) return b.end_date && b.end_date !== b.date ? 'Several days' : 'Once';
  if (b.days.length === 7) return 'Every day';
  const wk = ['mon', 'tue', 'wed', 'thu', 'fri'];
  if (b.days.length === 5 && wk.every(d => b.days!.includes(d as Day))) return 'Mon–Fri';
  return WEEK.filter(([d]) => b.days!.includes(d)).map(([, l]) => l).join(', ');
}

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
