import { z } from "@medusajs/framework/zod"
import { WORLD_BY_CODE, type Continent } from "../../lib/countries"

// Shipping: where the seller ships from, and the delivery options buyers choose at checkout
// (e.g. "DHL Express, 3-5 working days, NGN 45,000 to Europe and North America").
// Rates are the seller's own flat prices. Keep in sync with app/src/shipping.ts.

export const CARRIERS = ["dhl", "fedex", "ups", "aramex", "post", "local", "other"] as const
export const CONTINENT_CODES = ["AF", "EU", "NA", "SA", "AS", "OC"] as const satisfies readonly Continent[]

const text = (max: number) => z.string().max(max).transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim())
const country = z.string().regex(/^[A-Z]{2}$/).refine((c) => WORLD_BY_CODE.has(c), "Unknown country")

const ShippingOption = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,24}$/),
    carrier: z.enum(CARRIERS),
    // Shown to buyers, e.g. "DHL Express Worldwide"
    name: text(60).refine((s) => s.length > 0, "Give each delivery option a name"),
    // Flat price in the seller's currency (whole units).
    price: z.number().min(0).max(100_000_000),
    // e.g. "3-5 working days"
    days: text(40),
    // "domestic": within the seller's own country. "international": to the chosen continents.
    zone: z.enum(["domestic", "international"]),
    continents: z.array(z.enum(CONTINENT_CODES)).max(6),
  })
  .strict()
  .refine((o) => o.zone === "domestic" || o.continents.length > 0, "Choose where each international option ships to")

export const ShippingSchema = z
  .object({
    // Sender details printed on shipment forms.
    from: z
      .object({
        name: text(100),
        address: text(200),
        city: text(80),
        region: text(80),
        postal_code: text(20),
        country,
        phone: text(30),
      })
      .strict()
      .nullable(),
    options: z.array(ShippingOption).max(20),
  })
  .strict()
  .refine((s) => new Set(s.options.map((o) => o.id)).size === s.options.length, "Each delivery option needs its own id")

export type Shipping = z.infer<typeof ShippingSchema>
export type ShippingOptionT = Shipping["options"][number]

/** The country a seller ships from: their business country, or (sellers abroad) their ship-from address. */
export function homeCountry(seller: { country_code: string; shipping?: Shipping | null }): string | null {
  return seller.country_code === "DI" ? seller.shipping?.from?.country ?? null : seller.country_code
}

/** Delivery options a buyer in `country` can choose. */
export function optionsFor(seller: { country_code: string; shipping?: Shipping | null }, country: string): ShippingOptionT[] {
  const home = homeCountry(seller)
  const continent = WORLD_BY_CODE.get(country)?.continent
  return (seller.shipping?.options ?? []).filter((o) =>
    o.zone === "domestic" ? country === home : country !== home && !!continent && o.continents.includes(continent)
  )
}
