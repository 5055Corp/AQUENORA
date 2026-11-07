import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { SELLER_COUNTRIES } from "../../modules/seller/currency"

const shopName = z.string().trim().min(1, "Shop name is required").max(80)
const handle = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-zA-Z0-9-]+$/, "Use letters and numbers only")

export const CreateSellerSchema = z.object({
  name: shopName,
  handle: handle.optional(),
  category: z.string().trim().min(1).max(60).optional(),
  country_code: z.enum(SELLER_COUNTRIES).optional(),
  sells_abroad: z.boolean().optional(),
})
export type CreateSellerBody = z.infer<typeof CreateSellerSchema>

export const UpdateSellerSchema = z
  .object({
    name: shopName,
    handle,
    category: z.string().trim().min(1).max(60),
    country_code: z.enum(SELLER_COUNTRIES),
    sells_abroad: z.boolean(),
    theme: z.enum(["harmattan", "lagos", "savanna"]),
    accent: z.enum(["terracotta", "leaf", "indigo", "hibiscus"]),
    font: z.enum(["classic", "modern", "friendly"]),
    announcement: z.string().trim().max(120).nullable(),
    onboarding_completed: z.boolean(),
  })
  .partial()
  .strict()
export type UpdateSellerBody = z.infer<typeof UpdateSellerSchema>

const money = z.number().min(0).max(1_000_000_000)

export const CreateSellerProductSchema = z.object({
  title: z.string().trim().min(1, "Product name is required").max(120),
  price: z.number().int().min(0).max(1_000_000_000),
  description: z.string().trim().max(2000).optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  cost_price: money.optional(),
})

export const UpdateSellerProductSchema = z
  .object({
    title: z.string().trim().min(1, "Product name is required").max(120),
    price: z.number().int().min(0).max(1_000_000_000),
    stock: z.number().int().min(0).max(1_000_000),
    cost_price: money.nullable(),
  })
  .partial()
  .strict()
export type UpdateSellerProductBody = z.infer<typeof UpdateSellerProductSchema>

export const UpdateSellerOrderSchema = z.object({ status: z.enum(["shipped", "delivered"]) }).strict()
export type UpdateSellerOrderBody = z.infer<typeof UpdateSellerOrderSchema>

export const FinanceQuerySchema = z.object({ period: z.enum(["7d", "30d", "all"]).default("30d") })
export type FinanceQuery = z.infer<typeof FinanceQuerySchema>

/** Reads ?period= for the finance routes; anything else is a 400. */
export function parseFinanceQuery(query: unknown): FinanceQuery {
  const parsed = FinanceQuerySchema.safeParse(query ?? {})
  if (!parsed.success) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "period must be 7d, 30d or all")
  }
  return parsed.data
}
export type CreateSellerProductBody = z.infer<typeof CreateSellerProductSchema>
