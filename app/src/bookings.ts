// Shared booking defaults (used by signup and the Business tab).
import type { BookingSettings } from './api';

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
