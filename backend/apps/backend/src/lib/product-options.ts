// Product options: sizes, lengths, colours and other choices a buyer picks under a product,
// plus "made to order" and a notes box for measurements or special requests.
//
// Stored in the product's metadata (one Medusa variant per product stays as it is):
//   metadata.options          { groups: [{ name, choices: [{ label, price?, extra?, stock? }] }], stock_per_choice? }
//   metadata.made_to_order    number of days to make it, or absent
//   metadata.note_prompt      the question for the buyer's notes box, or absent
//
// Pricing: the FIRST option sets the full price per choice (e.g. Length: 12" = 45,000, 20" = 60,000;
// a choice without a price uses the product's price). Every other option is free or adds an extra
// amount (+2,000). Stock: one count for the product, or (stock_per_choice) one per choice of the
// first option. Made-to-order products never sell out.

import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"

export const MAX_OPTION_GROUPS = 7
export const MAX_CHOICES = 30

const amount = z.number().int().min(0).max(1_000_000_000)

const ChoiceSchema = z
  .object({
    label: z.string().trim().min(1, "Every choice needs a name").max(40),
    /** Full price for this choice (first option only). */
    price: amount.nullable().optional(),
    /** Added to the price (other options). */
    extra: amount.nullable().optional(),
    /** How many of this choice are left (first option, when stock_per_choice is on). */
    stock: z.number().int().min(0).max(1_000_000).nullable().optional(),
  })
  .strict()

export const ProductOptionsSchema = z
  .object({
    groups: z
      .array(
        z
          .object({
            name: z.string().trim().min(1, "Give the option a name, e.g. Size or Length").max(30),
            choices: z.array(ChoiceSchema).min(1, "Add at least one choice").max(MAX_CHOICES),
          })
          .strict()
      )
      .max(MAX_OPTION_GROUPS, `A product can have up to ${MAX_OPTION_GROUPS} options.`),
    stock_per_choice: z.boolean().optional(),
  })
  .strict()
  .superRefine((o, ctx) => {
    o.groups.forEach((g, gi) => {
      const seen = new Set<string>()
      for (const c of g.choices) {
        const key = c.label.toLowerCase()
        if (seen.has(key)) ctx.addIssue({ code: "custom", message: `"${c.label}" is in ${g.name} twice.`, path: ["groups", gi] })
        seen.add(key)
      }
    })
    const names = o.groups.map((g) => g.name.toLowerCase())
    if (new Set(names).size !== names.length) ctx.addIssue({ code: "custom", message: "Two options have the same name.", path: ["groups"] })
  })

export type ProductOptions = z.infer<typeof ProductOptionsSchema>

/** Fields shared by "add product" and "edit product". */
export const productOptionFields = {
  options: ProductOptionsSchema.nullable(),
  /** Days to make it; null = ready to ship. */
  made_to_order_days: z.number().int().min(1).max(180).nullable(),
  /** Question for the buyer's notes box (e.g. "Your measurements"); "" or null = no box. */
  note_prompt: z.string().trim().max(120).nullable(),
}

/** Tidies options before saving: prices only on the first option, extras only on the rest. */
export function cleanOptions(o: ProductOptions | null | undefined): ProductOptions | null {
  if (!o || o.groups.length === 0) return null
  const perChoice = !!o.stock_per_choice
  return {
    groups: o.groups.map((g, gi) => ({
      name: g.name.trim(),
      choices: g.choices.map((c) => ({
        label: c.label.trim(),
        ...(gi === 0 && c.price != null ? { price: c.price } : {}),
        ...(gi > 0 && c.extra ? { extra: c.extra } : {}),
        ...(gi === 0 && perChoice ? { stock: c.stock ?? 0 } : {}),
      })),
    })),
    ...(perChoice ? { stock_per_choice: true } : {}),
  }
}

/** Reads options back from metadata (anything malformed is ignored rather than breaking the store). */
export function readOptions(metadata: Record<string, unknown> | null | undefined): ProductOptions | null {
  const parsed = ProductOptionsSchema.safeParse(metadata?.options)
  return parsed.success && parsed.data.groups.length ? parsed.data : null
}

export function madeToOrderDays(metadata: Record<string, unknown> | null | undefined): number | null {
  const d = Number(metadata?.made_to_order)
  return Number.isInteger(d) && d > 0 ? d : null
}

export function notePrompt(metadata: Record<string, unknown> | null | undefined): string | null {
  const p = metadata?.note_prompt
  return typeof p === "string" && p.trim() ? p.trim() : null
}

/** With stock per choice, the product's own stock is the total of its choices. */
export function totalStock(o: ProductOptions | null, fallback: number): number {
  return o?.stock_per_choice ? o.groups[0].choices.reduce((a, c) => a + (c.stock ?? 0), 0) : fallback
}

/** Lowest price a buyer can pay (shown as "From ₦45,000"). */
export function fromPrice(o: ProductOptions | null, base: number): number {
  if (!o) return base
  return Math.min(...o.groups[0].choices.map((c) => c.price ?? base))
}

export type PricedChoice = {
  unit_price: number
  /** "Bone straight wig (20 inch, Natural black)" */
  title: string
  /** What the buyer picked, in option order. */
  options: { name: string; value: string }[]
  /** Index of the first option's choice (for stock per choice). */
  first_choice: number | null
}

/**
 * Works out the price of one product with the buyer's choices. Choices are the labels, in option
 * order. Throws a buyer-friendly error if a choice is missing or doesn't exist.
 */
export function priceWithChoices(
  product: { title: string; price: number; metadata?: Record<string, unknown> | null },
  choices: string[] | undefined
): PricedChoice {
  const o = readOptions(product.metadata)
  if (!o) {
    return { unit_price: product.price, title: product.title, options: [], first_choice: null }
  }
  const picked = choices ?? []
  if (picked.length !== o.groups.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Choose ${o.groups.map((g) => g.name.toLowerCase()).join(", ")} for ${product.title}.`)
  }
  let price = product.price
  let firstChoice: number | null = null
  const options = o.groups.map((g, gi) => {
    const ci = g.choices.findIndex((c) => c.label.toLowerCase() === String(picked[gi]).trim().toLowerCase())
    if (ci < 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `${product.title}: "${picked[gi]}" isn't available any more. Please choose again.`)
    }
    const c = g.choices[ci]
    if (gi === 0) {
      firstChoice = ci
      price = c.price ?? product.price
    } else {
      price += c.extra ?? 0
    }
    return { name: g.name, value: c.label }
  })
  return { unit_price: price, title: `${product.title} (${options.map((x) => x.value).join(", ")})`, options, first_choice: firstChoice }
}

/** How many can be bought: made to order = no limit; stock per choice = that choice's count. */
export function availableStock(
  product: { stock: number; metadata?: Record<string, unknown> | null },
  firstChoice: number | null
): number {
  if (madeToOrderDays(product.metadata)) return Number.MAX_SAFE_INTEGER
  const o = readOptions(product.metadata)
  if (o?.stock_per_choice && firstChoice != null) return o.groups[0].choices[firstChoice]?.stock ?? 0
  return product.stock
}

/** Metadata to save for a product's options settings (only the keys that were sent). */
export function optionMetadata(input: {
  options?: ProductOptions | null
  made_to_order_days?: number | null
  note_prompt?: string | null
}): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (input.options !== undefined) {
    const o = cleanOptions(input.options)
    out.options = o
    if (o?.stock_per_choice) out.stock = totalStock(o, 0)
  }
  if (input.made_to_order_days !== undefined) out.made_to_order = input.made_to_order_days ?? null
  if (input.note_prompt !== undefined) out.note_prompt = input.note_prompt?.trim() || null
  return out
}
