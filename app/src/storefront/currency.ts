// Showing prices in a buyer's own currency (e.g. Canadian dollars) on a store priced in Naira.
// Display only: Paystack charges in the seller's currency and the buyer's bank converts it.

import { useEffect, useState } from 'react';
import { fetchRates, LIVE } from '../api';
import { FALLBACK_RATES, WORLD, WORLD_BY_CODE } from '../countries';
import type { CountryId } from '../data';

export const sellerCurrency = (country: CountryId): string =>
  country === 'DI' ? 'USD' : WORLD_BY_CODE.get(country)?.currency ?? 'USD';

/** The buyer's country from their browser language (en-CA -> CA), if it's one we know. */
export function guessBuyerCountry(): string | null {
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    const region = l?.split('-')[1]?.toUpperCase();
    if (region && WORLD_BY_CODE.has(region)) return region;
  }
  return null;
}

/** Exchange rates (units per USD): live from the backend, built-in otherwise. */
export function useRates(): Record<string, number> {
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);
  useEffect(() => {
    if (!LIVE) return;
    let stale = false;
    fetchRates().then(r => { if (!stale && r) setRates(r); });
    return () => { stale = true; };
  }, []);
  return rates;
}

const names = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'currency' });
  } catch {
    return null;
  }
})();

/** Currencies a buyer can pick: every currency of a country we list that has an exchange rate. */
export function currencyChoices(rates: Record<string, number>, seller: string): { code: string; label: string }[] {
  const codes = [...new Set([seller, ...WORLD.map(c => c.currency)])].filter(c => c === seller || rates[c]);
  return codes
    .map(code => ({ code, label: `${code} · ${names?.of(code) ?? code}` }))
    .sort((a, b) => (a.code === seller ? -1 : b.code === seller ? 1 : a.code.localeCompare(b.code)));
}

/** Converts an amount in the seller's currency to the buyer's, or null if a rate is missing. */
export function convert(amount: number, from: string, to: string, rates: Record<string, number>): number | null {
  if (from === to) return amount;
  const a = rates[from];
  const b = rates[to];
  return a && b ? (amount / a) * b : null;
}

/** "CA$45" style formatting; whole units for large-unit currencies. */
export function formatMoney(amount: number, currency: string): string {
  const big = amount >= 1000;
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: big ? 0 : 2, minimumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

const CUR_KEY = 'aqenora-currency';
export function loadCurrency(): string | null {
  try {
    const v = localStorage.getItem(CUR_KEY);
    return v && /^[A-Z]{3}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}
export function saveCurrency(code: string) {
  try {
    localStorage.setItem(CUR_KEY, code);
  } catch {
    /* storage unavailable */
  }
}
