import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { SELLER_MODULE } from "../../modules/seller"
import SellerModuleService from "../../modules/seller/service"

export type CreateSellerData = {
  email: string
  name: string
  handle: string
  category?: string
  country_code?: "NG" | "GH" | "ZA" | "CI" | "SN" | "DI"
  currency_code?: string
  sells_abroad?: boolean
}

export type UpdateSellerData = Partial<Omit<CreateSellerData, "email">> & {
  paystack_subaccount_code?: string | null
  payout?: Record<string, unknown> | null
  shipping?: Record<string, unknown> | null
  theme?: "harmattan" | "lagos" | "savanna"
  accent?: "terracotta" | "leaf" | "indigo" | "hibiscus"
  font?: "classic" | "modern" | "friendly"
  announcement?: string | null
  onboarding_completed?: boolean
  design?: Record<string, unknown> | null
  pickup?: Record<string, unknown> | null
  // Set only by the plan and domain routes (never from the seller's own settings body).
  trial_ends_at?: Date | null
  pro_paid_until?: Date | null
  custom_domain?: string | null
  domain_verified_at?: Date | null
}

/**
 * Web addresses (<name>.aqenora.com) shops can't have, because AQENORA uses them itself.
 * Keep in sync with RESERVED in app/server.mjs and RESERVED_SUBDOMAINS in app/src/api.ts.
 */
export const RESERVED_HANDLES = new Set([
  "app", "www", "api", "admin", "mail", "static", "cdn", "stores", "store", "shop", "help", "support",
  "status", "blog", "docs", "billing", "pay", "checkout", "account", "login", "signup", "aqenora",
])

/** Fails with a clear message if the web address is reserved or another seller already uses it. */
export const ensureSellerHandleAvailableStep = createStep(
  "ensure-seller-handle-available",
  async (input: { handle?: string; seller_id?: string }, { container }) => {
    if (!input.handle) {
      return new StepResponse(true)
    }
    if (RESERVED_HANDLES.has(input.handle)) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `The web address ${input.handle}.aqenora.com is reserved for AQENORA. Try another shop name or address.`
      )
    }
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const [existing] = await sellers.listSellers({ handle: input.handle }, { take: 1 })
    if (existing && existing.id !== input.seller_id) {
      throw new MedusaError(
        MedusaError.Types.DUPLICATE_ERROR,
        `The web address ${input.handle}.aqenora.com is already taken. Try another shop name or address.`
      )
    }
    return new StepResponse(true)
  }
)

export const createSellerStep = createStep(
  "create-seller",
  async (input: CreateSellerData, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const seller = await sellers.createSellers(input)
    return new StepResponse(seller, seller.id)
  },
  async (sellerId, { container }) => {
    if (!sellerId) {
      return
    }
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellers.deleteSellers(sellerId)
  }
)

export const updateSellerStep = createStep(
  "update-seller",
  async (input: { id: string; data: UpdateSellerData }, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const before = await sellers.retrieveSeller(input.id)
    const updated = await sellers.updateSellers({ id: input.id, ...input.data })

    // Keep only the fields we changed so compensation restores exactly those.
    const previous: Record<string, unknown> = { id: input.id }
    for (const key of Object.keys(input.data)) {
      previous[key] = before[key as keyof typeof before]
    }
    return new StepResponse(updated, previous)
  },
  async (previous, { container }) => {
    if (!previous) {
      return
    }
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellers.updateSellers(previous as { id: string })
  }
)
