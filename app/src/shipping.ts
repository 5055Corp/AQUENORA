// Shipping: the seller's ship-from address and delivery options. Same shape as the backend's
// ShippingSchema (backend/apps/backend/src/modules/seller/shipping.ts).

import { WORLD_BY_CODE, type Continent } from './countries';

export const CARRIERS = {
  dhl: 'DHL',
  fedex: 'FedEx',
  ups: 'UPS',
  aramex: 'Aramex',
  post: 'Post office',
  local: 'Local courier / dispatch rider',
  other: 'Other',
} as const;
export type Carrier = keyof typeof CARRIERS;

export const CONTINENT_LIST: Continent[] = ['AF', 'EU', 'NA', 'SA', 'AS', 'OC'];

export interface ShippingOption {
  id: string;
  carrier: Carrier;
  name: string;
  /** Flat price in the seller's currency. */
  price: number;
  days: string;
  zone: 'domestic' | 'international';
  continents: Continent[];
}

export interface ShipFrom {
  name: string;
  address: string;
  city: string;
  region: string;
  postal_code: string;
  /** ISO code, e.g. "NG". */
  country: string;
  phone: string;
}

export interface Shipping {
  from: ShipFrom | null;
  options: ShippingOption[];
}

/** Ready-made names for common services; the seller can change them. */
export const SUGGESTED_NAME: Record<Carrier, string> = {
  dhl: 'DHL Express Worldwide',
  fedex: 'FedEx International Priority',
  ups: 'UPS Worldwide Saver',
  aramex: 'Aramex Priority Express',
  post: 'Post office (registered mail)',
  local: 'Delivery by courier',
  other: '',
};

export function newOptionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Checks shipping settings from the server or this browser; anything malformed is dropped. */
export function normalizeShipping(raw: unknown): Shipping {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Shipping>;
  const f = r.from as Partial<ShipFrom> | null | undefined;
  const from: ShipFrom | null =
    f && typeof f === 'object' && typeof f.country === 'string' && WORLD_BY_CODE.has(f.country)
      ? { name: str(f.name, 100), address: str(f.address, 200), city: str(f.city, 80), region: str(f.region, 80), postal_code: str(f.postal_code, 20), country: f.country, phone: str(f.phone, 30) }
      : null;
  const options = (Array.isArray(r.options) ? r.options : []).flatMap((o): ShippingOption[] => {
    if (!o || typeof o !== 'object' || typeof o.id !== 'string' || !(o.carrier in CARRIERS)) return [];
    const continents = (Array.isArray(o.continents) ? o.continents : []).filter((c): c is Continent => CONTINENT_LIST.includes(c));
    return [{
      id: o.id,
      carrier: o.carrier,
      name: str(o.name, 60),
      price: Math.max(0, Number(o.price) || 0),
      days: str(o.days, 40),
      zone: o.zone === 'domestic' ? 'domestic' : 'international',
      continents,
    }];
  });
  return { from, options };
}

/** Country the seller ships from: their business country, or (sellers abroad) their ship-from address. */
export function homeCountry(sellerCountry: string, shipping: Shipping): string | null {
  return sellerCountry === 'DI' ? shipping.from?.country ?? null : sellerCountry;
}

/** Delivery options a buyer in `country` can choose. */
export function optionsFor(shipping: Shipping, home: string | null, country: string): ShippingOption[] {
  const continent = WORLD_BY_CODE.get(country)?.continent;
  return shipping.options.filter(o =>
    o.zone === 'domestic' ? country === home : country !== home && !!continent && o.continents.includes(continent),
  );
}
