import { z } from "@medusajs/framework/zod"

// In-store pickup: sellers with a physical shop let nearby customers collect orders during
// business hours. Keep in sync with app/src/pickup.ts.

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Times look like 09:00 or 17:30")
const text = (max: number) => z.string().max(max).transform((s) => s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim())

const Hours = z
  .object({ open: time, close: time })
  .strict()
  .refine((h) => h.open < h.close, "Closing time must be after opening time")

export const PickupSchema = z
  .object({
    enabled: z.boolean(),
    // Street address customers come to, e.g. "12 Admiralty Way, Lekki Phase 1"
    address: text(200),
    // Short area shown on the store, e.g. "Lekki, Lagos"
    area: text(60),
    // Opening hours per day; null = closed that day.
    hours: z.object(Object.fromEntries(DAYS.map((d) => [d, Hours.nullable()])) as Record<(typeof DAYS)[number], z.ZodNullable<typeof Hours>>).strict(),
    instructions: text(300),
  })
  .strict()
  .refine((p) => !p.enabled || (p.address.length > 0 && p.area.length > 0), "Add your shop's address and area to turn on pickup")
  .refine((p) => !p.enabled || DAYS.some((d) => p.hours[d]), "Add the hours you're open on at least one day")

export type Pickup = z.infer<typeof PickupSchema>
