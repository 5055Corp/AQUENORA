import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { renderVerificationEmail } from "../lib/verification-email"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import type { SubmitVerificationBody } from "../api/sellers/validators"

/** Replaces the seller's verification documents and marks them "pending" for review. */
const saveVerificationStep = createStep(
  "save-verification",
  async (input: { seller_id: string; body: SubmitVerificationBody }, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const seller = await sellers.retrieveSeller(input.seller_id)
    if (seller.verification_status === "verified") {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Your store is already verified.")
    }
    const old = await sellers.listSellerDocuments({ seller_id: input.seller_id }, { select: ["id"] })
    if (old.length) await sellers.deleteSellerDocuments(old.map((d) => d.id))
    await sellers.createSellerDocuments(input.body.documents.map((d) => ({ seller_id: input.seller_id, ...d })))
    const { documents: _docs, ...details } = input.body
    await sellers.updateSellers({
      id: input.seller_id,
      verification_status: "pending",
      verification: { ...details, submitted_at: new Date().toISOString(), reviewed_at: null, reject_reason: null },
    })
    return new StepResponse(true)
  }
)

export const submitSellerVerificationWorkflow = createWorkflow(
  "submit-seller-verification",
  function (input: { seller_id: string; body: SubmitVerificationBody }) {
    saveVerificationStep(input)
    return new WorkflowResponse(true)
  }
)

/** AQUENORA's decision: approve (seller can take payments) or reject with a reason. */
const decideVerificationStep = createStep(
  "decide-verification",
  async (input: { seller_id: string; decision: "approve" | "reject"; reason?: string }, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const seller = await sellers.retrieveSeller(input.seller_id)
    const approved = input.decision === "approve"
    const verification = {
      ...((seller.verification as Record<string, unknown> | null) ?? {}),
      reviewed_at: new Date().toISOString(),
      reject_reason: approved ? null : input.reason ?? null,
    }
    await sellers.updateSellers({
      id: seller.id,
      verification_status: approved ? "verified" : "rejected",
      verification,
      verified_at: approved ? new Date() : null,
    })
    return new StepResponse({ email: seller.email, name: seller.name, approved })
  }
)

export const reviewSellerVerificationWorkflow = createWorkflow(
  "review-seller-verification",
  function (input: { seller_id: string; decision: "approve" | "reject"; reason?: string }) {
    const result = decideVerificationStep(input)
    const notifications = transform({ result, input }, ({ result, input }) => [
      {
        to: result.email,
        channel: "email",
        template: "aquenora-verification",
        data: renderVerificationEmail({ shopName: result.name, approved: result.approved, reason: input.reason }),
      },
    ])
    sendNotificationsStep(notifications)
    return new WorkflowResponse(result)
  }
)
