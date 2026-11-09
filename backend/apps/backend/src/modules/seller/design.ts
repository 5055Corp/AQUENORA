import { z } from "@medusajs/framework/zod"

// A seller's store design. The seller app's editor writes it and the public store page draws it.
// Keep in sync with app/src/design.ts.

export const STORE_FONTS = [
  "newsreader",
  "playfair",
  "dmserif",
  "lora",
  "manrope",
  "poppins",
  "nunito",
  "spacegrotesk",
  "fredoka",
  "josefin",
] as const

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours must look like #1c1a17")
const line = (max: number) => z.string().max(max).transform((s) => s.replace(/[\u0000-\u001f\u007f]/g, " ").trim())

export const StoreDesignSchema = z
  .object({
    version: z.literal(1),
    colors: z
      .object({
        background: hex,
        text: hex,
        accent: hex,
        accent_text: hex,
        card: hex,
      })
      .strict(),
    fonts: z.object({ heading: z.enum(STORE_FONTS), body: z.enum(STORE_FONTS) }).strict(),
    header: z.object({ align: z.enum(["left", "center"]) }).strict(),
    banner: z
      .object({
        style: z.enum(["large", "slim", "none"]),
        headline: line(80),
        subtext: line(160),
      })
      .strict(),
    products: z
      .object({
        columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
        show_stock: z.boolean(),
      })
      .strict(),
    shape: z
      .object({
        corners: z.enum(["round", "soft", "square"]),
        buttons: z.enum(["pill", "rounded", "square"]),
      })
      .strict(),
    announcement: line(120),
    // Multi-line text; newlines are kept.
    about: z.string().max(600).transform((s) => s.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim()),
    social: z
      .object({
        instagram: z
          .string()
          .max(31)
          .transform((s) => s.trim().replace(/^@/, ""))
          .refine((s) => s === "" || /^[A-Za-z0-9._]{1,30}$/.test(s), "Instagram names use letters, numbers, . and _"),
        whatsapp: z
          .string()
          .max(20)
          .transform((s) => s.replace(/[\s()+-]/g, ""))
          .refine((s) => s === "" || /^\d{7,15}$/.test(s), "Use the full WhatsApp number with country code, e.g. 2348012345678"),
      })
      .strict(),
  })
  .strict()

export type StoreDesign = z.infer<typeof StoreDesignSchema>
