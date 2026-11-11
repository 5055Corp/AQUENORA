import { MedusaError } from "@medusajs/framework/utils"
import { z } from "@medusajs/framework/zod"
import { SELLER_COUNTRIES } from "../../modules/seller/currency"
import { StoreDesignSchema } from "../../modules/seller/design"
import { PickupSchema } from "../../modules/seller/pickup"
import { ShippingSchema } from "../../modules/seller/shipping"

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
    design: StoreDesignSchema,
    pickup: PickupSchema,
    shipping: ShippingSchema,
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

export const UpdateSellerOrderSchema = z.object({ status: z.enum(["shipped", "delivered", "ready", "collected"]) }).strict()
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

export const SendCampaignSchema = z
  .object({
    subject: z.string().trim().min(1, "Add a subject").max(120),
    message: z.string().trim().min(1, "Write a message").max(5000),
    audience: z.enum(["all", "repeat", "lapsed"]),
  })
  .strict()
export type SendCampaignBody = z.infer<typeof SendCampaignSchema>

export const SetDomainSchema = z.object({ domain: z.string().trim().min(3).max(253) }).strict()
export type SetDomainBody = z.infer<typeof SetDomainSchema>

export const PlanPricesSchema = z
  .object({
    prices: z
      .array(
        z
          .object({
            country_code: z.enum(SELLER_COUNTRIES),
            monthly_price: z.number().min(0).max(100_000_000),
          })
          .strict()
      )
      .min(1)
      .max(20),
  })
  .strict()
export type PlanPricesBody = z.infer<typeof PlanPricesSchema>

export const BillingSettingsSchema = z
  .object({
    free_commission_percent: z.number().min(0).max(30),
    pro_commission_percent: z.number().min(0).max(30),
    trial_days: z.number().int().min(0).max(90),
  })
  .partial()
  .strict()
export type BillingSettingsBody = z.infer<typeof BillingSettingsSchema>

export const MarkPaidSchema = z.object({ months: z.number().int().min(1).max(24) }).strict()
export type MarkPaidBody = z.infer<typeof MarkPaidSchema>

// ---- payments (Paystack) ----

/** The seller's bank account for payouts. */
export const SetPayoutSchema = z
  .object({
    bank_code: z.string().trim().min(1, "Choose your bank").max(40),
    account_number: z
      .string()
      .trim()
      .regex(/^[0-9A-Za-z]{6,20}$/, "Enter your account number (numbers only, no spaces)"),
  })
  .strict()
export type SetPayoutBody = z.infer<typeof SetPayoutSchema>

/** A buyer's checkout from a store page. */
export const CheckoutSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address").max(200),
    name: z.string().trim().min(1, "Enter your name").max(100),
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number"),
    fulfillment: z.enum(["delivery", "pickup"]).default("delivery"),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    /** Delivery country (ISO code, e.g. "CA"), state or province, and postcode. */
    country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Choose your country").optional(),
    region: z.string().trim().max(80).optional(),
    postal_code: z.string().trim().max(20).optional(),
    /** The delivery option chosen (see the store's shipping options). */
    shipping_option_id: z.string().max(24).optional(),
    /** The currency prices were shown in (for the seller's information; payment is in the seller's currency). */
    display_currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
    marketing_opt_in: z.boolean().default(false),
    /** Where Paystack sends the buyer back to (the store page). Only http(s). */
    return_url: z.string().url().max(500).refine((u) => /^https?:\/\//.test(u), "Invalid return address"),
    items: z
      .array(z.object({ product_id: z.string().min(1).max(100), quantity: z.number().int().min(1).max(100) }).strict())
      .min(1, "Your bag is empty")
      .max(50),
  })
  .strict()
  .refine((b) => b.fulfillment === "pickup" || (!!b.address && !!b.city && !!b.country), {
    message: "Enter your delivery address, city and country",
    path: ["address"],
  })
export type CheckoutBody = z.infer<typeof CheckoutSchema>

export const VerifyPaymentSchema = z.object({ reference: z.string().trim().min(4).max(100) }).strict()
export type VerifyPaymentBody = z.infer<typeof VerifyPaymentSchema>

/** A store image, already resized in the seller's browser. `data` is base64 (no data: prefix). */
export const UploadImageSchema = z
  .object({
    kind: z.enum(["logo", "banner"]),
    mime_type: z.enum(["image/webp", "image/jpeg", "image/png"]),
    // About 2 MB of image at most once decoded.
    data: z.string().min(16).max(2_800_000).regex(/^[A-Za-z0-9+/]+=*$/, "Not an image"),
  })
  .strict()
export type UploadImageBody = z.infer<typeof UploadImageSchema>

// ---- Pro by card ----
export const ProCheckoutSchema = z.object({ return_url: z.string().url().max(500) }).strict()
export type ProCheckoutBody = z.infer<typeof ProCheckoutSchema>
export const ProConfirmSchema = z.object({ reference: z.string().trim().regex(/^aq[pr]_[0-9a-f]{8,64}$/) }).strict()
export type ProConfirmBody = z.infer<typeof ProConfirmSchema>
export const AutoRenewSchema = z.object({ on: z.boolean() }).strict()
export type AutoRenewBody = z.infer<typeof AutoRenewSchema>
