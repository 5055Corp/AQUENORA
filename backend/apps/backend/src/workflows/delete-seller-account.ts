import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse, when } from "@medusajs/framework/workflows-sdk"
import { deleteProductsWorkflow } from "@medusajs/medusa/core-flows"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

export type DeleteSellerAccountInput = {
  seller_id: string
  auth_identity_id: string
}

/** The seller's product ids, so they can be deleted with Medusa's own product workflow. */
const listSellerProductIdsStep = createStep(
  "list-seller-product-ids",
  async (input: { seller_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "products.id"],
      filters: { id: input.seller_id },
    })
    const ids = (data[0]?.products ?? []).flatMap((p) => (p?.id ? [p.id] : []))
    return new StepResponse(ids)
  }
)

/** Buyers' details the seller collected (marketing contacts), the seller's campaigns and unpaid checkouts. */
const deleteSellerCustomerDataStep = createStep(
  "delete-seller-customer-data",
  async (input: { seller_id: string }, { container }) => {
    const marketing: MarketingModuleService = container.resolve(MARKETING_MODULE)
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)

    const contacts = await marketing.listMarketingContacts({ seller_id: input.seller_id }, { select: ["id"] })
    if (contacts.length) await marketing.deleteMarketingContacts(contacts.map((c) => c.id))
    const campaigns = await marketing.listMarketingCampaigns({ seller_id: input.seller_id }, { select: ["id"] })
    if (campaigns.length) await marketing.deleteMarketingCampaigns(campaigns.map((c) => c.id))

    // Paid checkouts are part of order records and are kept; unpaid ones hold buyer details for nothing.
    const checkouts = await sellers.listCheckouts({ seller_id: input.seller_id }, { select: ["id", "status"] })
    const unpaid = checkouts.filter((c) => (c as { status?: string }).status !== "paid").map((c) => c.id)
    if (unpaid.length) await sellers.deleteCheckouts(unpaid)
    return new StepResponse(true)
  }
)

/**
 * Takes the store offline for good: personal and store details are cleared, the web address is freed,
 * and the seller record is soft-deleted so past orders (kept for tax law) still point at it.
 */
const closeSellerStep = createStep(
  "close-seller",
  async (input: { seller_id: string }, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const tag = input.seller_id.toLowerCase()
    await sellers.updateSellers({
      id: input.seller_id,
      email: `deleted-${tag}@deleted.aquenora.com`,
      name: "Deleted store",
      handle: `deleted-${tag}`,
      announcement: null,
      payout: null,
      pro_billing: null,
      design: null,
      pickup: null,
      shipping: null,
      custom_domain: null,
      domain_verified_at: null,
      trial_ends_at: null,
      pro_paid_until: null,
    })
    await sellers.softDeleteSellers([input.seller_id])
    return new StepResponse(true)
  }
)

/** Removes the seller's login, so the email can't sign in (and can be used to sign up again). */
const deleteSellerLoginStep = createStep(
  "delete-seller-login",
  async (input: { auth_identity_id: string }, { container }) => {
    const auth = container.resolve(Modules.AUTH)
    await auth.deleteAuthIdentities([input.auth_identity_id])
    return new StepResponse(true)
  }
)

/**
 * Deletes a seller's account (Settings → Delete account; Apple requires in-app deletion).
 * Order and payment records stay, as Nigerian tax law requires; see the privacy policy.
 */
export const deleteSellerAccountWorkflow = createWorkflow(
  "delete-seller-account",
  function (input: DeleteSellerAccountInput) {
    const productIds = listSellerProductIdsStep({ seller_id: input.seller_id })
    when({ productIds }, ({ productIds }) => productIds.length > 0).then(() => {
      deleteProductsWorkflow.runAsStep({ input: transform({ productIds }, ({ productIds }) => ({ ids: productIds })) })
    })
    deleteSellerCustomerDataStep({ seller_id: input.seller_id })
    closeSellerStep({ seller_id: input.seller_id })
    deleteSellerLoginStep({ auth_identity_id: input.auth_identity_id })
    return new WorkflowResponse({ deleted: true })
  }
)
