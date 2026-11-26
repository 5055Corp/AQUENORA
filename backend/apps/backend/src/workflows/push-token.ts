import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { type PushToken, withPushToken } from "../lib/push"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

const savePushTokenStep = createStep("save-push-token", async (input: { seller_id: string; token: string; remove?: boolean }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const s = (await sellers.retrieveSeller(input.seller_id, { select: ["id", "push_tokens"] })) as unknown as { push_tokens: PushToken[] | null }
  const next = input.remove ? (s.push_tokens ?? []).filter((t) => t.token !== input.token) : withPushToken(s.push_tokens, input.token)
  await sellers.updateSellers({ id: input.seller_id, push_tokens: next } as never)
  return new StepResponse(next.length, { id: input.seller_id, push_tokens: s.push_tokens })
}, async (before, { container }) => {
  // Undo: put the previous list back.
  if (before) await container.resolve<SellerModuleService>(SELLER_MODULE).updateSellers(before as never)
})

/** Saves (or forgets, on log-out) this iPhone for the seller's push notifications. */
export const savePushTokenWorkflow = createWorkflow("save-push-token", function (input: { seller_id: string; token: string; remove?: boolean }) {
  return new WorkflowResponse(savePushTokenStep(input))
})
