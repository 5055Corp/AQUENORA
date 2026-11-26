// Product options in the browser: the same rules as the server (backend lib/product-options.ts).
// The FIRST option sets the full price per choice (a choice without a price uses the product's
// price); every other option is free or adds an extra amount. The server always works out the
// real price at checkout; this is only for showing it.

export interface OptionChoice {
  label: string;
  /** Full price for this choice (first option only). */
  price?: number | null;
  /** Added to the price (other options). */
  extra?: number | null;
  /** Left in stock (first option, when stock is per choice). */
  stock?: number | null;
  /** A photo for this choice (shown first when the buyer picks it). */
  image?: string | null;
}

export interface ProductOptions {
  groups: { name: string; choices: OptionChoice[] }[];
  stock_per_choice?: boolean;
}

export const MAX_OPTION_GROUPS = 7;

/** Index of each picked choice in its option (-1 = not picked yet). */
export type Picked = number[];

export function priceFor(base: number, options: ProductOptions | null | undefined, picked: Picked): number {
  if (!options?.groups.length) return base;
  let price = base;
  options.groups.forEach((g, gi) => {
    const c = g.choices[picked[gi]];
    if (!c) return;
    if (gi === 0) price = c.price ?? base;
    else price += c.extra ?? 0;
  });
  return price;
}

/** Lowest price ("From ₦45,000"). */
export function fromPrice(base: number, options: ProductOptions | null | undefined): number {
  if (!options?.groups.length) return base;
  return Math.min(...options.groups[0].choices.map(c => c.price ?? base));
}

/** True when the first option's choices have different prices. */
export function variesInPrice(base: number, options: ProductOptions | null | undefined): boolean {
  if (!options?.groups.length) return false;
  return new Set(options.groups[0].choices.map(c => c.price ?? base)).size > 1 || options.groups.slice(1).some(g => g.choices.some(c => (c.extra ?? 0) > 0));
}

/** How many can be bought with these choices. */
export function stockFor(stock: number, options: ProductOptions | null | undefined, picked: Picked, madeToOrderDays?: number | null): number {
  if (madeToOrderDays) return 999;
  if (options?.stock_per_choice && picked[0] >= 0) return options.groups[0].choices[picked[0]]?.stock ?? 0;
  return stock;
}

export function choiceLabels(options: ProductOptions | null | undefined, picked: Picked): string[] {
  return (options?.groups ?? []).map((g, gi) => g.choices[picked[gi]]?.label ?? '');
}

/** Picked indexes from saved labels (e.g. from the bag); -1 for anything no longer offered. */
export function pickedFromLabels(options: ProductOptions | null | undefined, labels: string[]): Picked {
  return (options?.groups ?? []).map((g, gi) => g.choices.findIndex(c => c.label.toLowerCase() === (labels[gi] ?? '').toLowerCase()));
}

/** Photos to show: the photo of the last picked choice that has one comes first. */
export function photosFor(images: string[], options: ProductOptions | null | undefined, picked: Picked): string[] {
  let lead: string | null = null;
  (options?.groups ?? []).forEach((g, gi) => {
    const img = g.choices[picked[gi]]?.image;
    if (img) lead = img;
  });
  return lead ? [lead, ...images.filter(u => u !== lead)] : images;
}
