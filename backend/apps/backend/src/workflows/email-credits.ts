import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { confirmEmailPurchase, startEmailPurchase } from "../lib/email-credits"

const buyEmailsStep = createStep("buy-emails", async (input: { seller_id: string; count: number; return_url: string }, { container }) => {
  return new StepResponse(await startEmailPurchase(container, input.seller_id, input.count, input.return_url))
})
export const buyEmailsWorkflow = createWorkflow("buy-emails", function (input: { seller_id: string; count: number; return_url: string }) {
  return new WorkflowResponse(buyEmailsStep(input))
})

const confirmEmailsStep = createStep("confirm-emails", async (input: { reference: string; seller_id?: string }, { container }) => {
  return new StepResponse(await confirmEmailPurchase(container, input.reference, input.seller_id))
})
export const confirmEmailsWorkflow = createWorkflow("confirm-emails", function (input: { reference: string; seller_id?: string }) {
  return new WorkflowResponse(confirmEmailsStep(input))
})
