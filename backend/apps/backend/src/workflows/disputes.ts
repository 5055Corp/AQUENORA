import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { supportEmail } from "../lib/account-email"
import {
  addWorkingDays,
  buyerUpdateEmail,
  checkFiles,
  sellerNewDisputeEmail,
  sellerUpdateEmail,
  toDisputeView,
  type DisputeMessage,
  type DisputeReason,
  type DisputeRecord,
  type Mail,
} from "../lib/disputes"
import { trackUrl } from "../lib/order-tracking"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

type File = { mime_type: string; data: string }
type OrderInfo = {
  id: string
  display_id: number
  email: string
  status: string
  currency_code: string
  shipping_address?: { first_name?: string | null; last_name?: string | null } | null
  seller?: { id: string; name: string; email: string; handle: string } | null
}

async function orderInfo(container: { resolve: (k: string) => unknown }, orderId: string): Promise<OrderInfo> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as { graph: (q: unknown) => Promise<{ data: unknown[] }> }
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "status", "currency_code", "shipping_address.first_name", "shipping_address.last_name", "seller.id", "seller.name", "seller.email", "seller.handle"],
    filters: { id: orderId },
  })
  const o = data[0] as OrderInfo | undefined
  if (!o?.seller) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.")
  return o
}

async function saveFiles(sellers: SellerModuleService, disputeId: string, from: "buyer" | "seller", files: File[] | undefined): Promise<string[]> {
  if (!files?.length) return []
  checkFiles(files)
  const made = await sellers.createDisputeFiles(files.map((f) => ({ dispute_id: disputeId, from, mime_type: f.mime_type, data: f.data })))
  return (Array.isArray(made) ? made : [made]).map((f) => f.id)
}

// ---------------- opening a dispute (buyer, from the tracking link) ----------------

export type OpenDisputeInput = { order_id: string; reason: DisputeReason; message: string; files?: File[] }

const openDisputeStep = createStep(
  "open-dispute",
  async (input: OpenDisputeInput, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const order = await orderInfo(container, input.order_id)
    if (order.status === "canceled") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This order was cancelled.")
    const [existing] = await sellers.listDisputes({ order_id: order.id })
    if (existing) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "You've already reported a problem with this order. You can add a message to it.")
    checkFiles(input.files)
    const name = [order.shipping_address?.first_name, order.shipping_address?.last_name].filter(Boolean).join(" ") || null
    const now = new Date()
    const created = await sellers.createDisputes({
      order_id: order.id,
      seller_id: order.seller!.id,
      order_display_id: order.display_id,
      buyer_email: order.email,
      buyer_name: name,
      reason: input.reason,
      status: "open",
      messages: [] as never,
      reply_by: addWorkingDays(now, 2),
    })
    const files = await saveFiles(sellers, created.id, "buyer", input.files)
    const messages: DisputeMessage[] = [{ from: "buyer", text: input.message, at: now.toISOString(), ...(files.length ? { files } : {}) }]
    const d = (await sellers.updateDisputes({ id: created.id, messages: messages as never })) as unknown as DisputeRecord
    return new StepResponse(
      { dispute: toDisputeView(d), mails: [sellerNewDisputeEmail(d, order.seller!, input.message)] },
      created.id
    )
  },
  async (id, { container }) => {
    if (!id) return
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellers.deleteDisputes(id)
  }
)

const mailsToNotifications = (mails: Mail[]) =>
  mails.map((m) => ({ to: m.to, channel: "email", template: "aquenora-dispute", data: { subject: m.subject, text: m.text, html: m.html, reply_to: supportEmail() } }))

export const openDisputeWorkflow = createWorkflow("open-dispute", function (input: OpenDisputeInput) {
  const result = openDisputeStep(input)
  const notifications = transform({ result }, ({ result }) => mailsToNotifications(result.mails))
  sendNotificationsStep(notifications)
  return new WorkflowResponse(transform({ result }, ({ result }) => result.dispute))
})

// ---------------- everything after: messages, refunds, escalation, AQUENORA's decision ----------------

export type DisputeActionInput = {
  dispute_id: string
  actor: "buyer" | "seller" | "aquenora"
  /** For sellers: their own id (they can only act on their own disputes). */
  seller_id?: string
  action: "message" | "refunded" | "confirm" | "escalate" | "decide"
  text?: string
  files?: File[]
  amount?: number
  outcome?: "refund_required" | "seller"
}

const disputeActionStep = createStep("dispute-action", async (input: DisputeActionInput, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const d = (await sellers.retrieveDispute(input.dispute_id)) as unknown as DisputeRecord
  if (input.actor === "seller" && d.seller_id !== input.seller_id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found.")
  const order = await orderInfo(container, d.order_id)
  const seller = order.seller!
  const link = trackUrl(seller.handle, order.id)
  const cur = order.currency_code
  const now = new Date().toISOString()
  const view = toDisputeView(d)
  const closed = d.status === "resolved"
  const messages = [...(d.messages ?? [])]
  const update: Record<string, unknown> = { id: d.id }
  let next = { ...d }
  const mails: Mail[] = []
  const fail = (m: string) => {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, m)
  }

  switch (input.action) {
    case "message": {
      if (closed) fail("This problem is closed.")
      if (!input.text?.trim()) fail("Write a message.")
      const files = await saveFiles(sellers, d.id, input.actor === "seller" ? "seller" : "buyer", input.files)
      messages.push({ from: input.actor, text: input.text!.trim(), at: now, ...(files.length ? { files } : {}) })
      update.messages = messages
      if (input.actor === "seller" && d.status === "open") update.status = "replied"
      next = { ...d, messages, status: (update.status as DisputeRecord["status"]) ?? d.status }
      if (input.actor === "seller") mails.push(buyerUpdateEmail(next, seller.name, "reply", link, cur))
      else if (input.actor === "buyer") mails.push(sellerUpdateEmail(next, seller, "message", cur))
      else mails.push(buyerUpdateEmail(next, seller.name, "reply", link, cur), sellerUpdateEmail(next, seller, "message", cur))
      break
    }
    case "refunded": {
      if (input.actor !== "seller") fail("Only the seller can mark a refund.")
      if (closed) fail("This problem is closed.")
      if (!input.amount || input.amount <= 0) fail("Enter how much you sent back.")
      const [file] = await saveFiles(sellers, d.id, "seller", input.files)
      const refund = { amount: input.amount!, at: now, ...(input.text?.trim() ? { note: input.text.trim() } : {}), ...(file ? { file } : {}) }
      messages.push({ from: "seller", text: `Refunded ${input.amount}${input.text?.trim() ? `: ${input.text.trim()}` : ""}`, at: now, ...(file ? { files: [file] } : {}) })
      Object.assign(update, { refund, status: "refunded", messages })
      next = { ...d, refund, status: "refunded", messages }
      mails.push(buyerUpdateEmail(next, seller.name, "refunded", link, cur))
      break
    }
    case "confirm": {
      if (input.actor !== "buyer" && input.actor !== "aquenora") fail("Only the buyer can confirm.")
      if (closed) fail("This problem is already closed.")
      messages.push({ from: input.actor, text: input.actor === "buyer" ? "I got my refund. Thank you." : input.text?.trim() || "Closed by AQUENORA.", at: now })
      Object.assign(update, { status: "resolved", resolved_at: new Date(), messages })
      next = { ...d, status: "resolved", messages }
      mails.push(sellerUpdateEmail(next, seller, "confirmed", cur))
      break
    }
    case "escalate": {
      if (input.actor !== "buyer") fail("Only the buyer can ask AQUENORA to step in.")
      if (!view.can_escalate) fail("Please give the shop until the reply date first.")
      messages.push({ from: "buyer", text: input.text?.trim() || "I'd like AQUENORA to help.", at: now })
      Object.assign(update, { status: "escalated", messages })
      next = { ...d, status: "escalated", messages }
      mails.push(sellerUpdateEmail(next, seller, "escalated", cur))
      break
    }
    case "decide": {
      if (input.actor !== "aquenora") fail("Only AQUENORA decides.")
      if (!input.outcome || !input.text?.trim()) fail("Choose an outcome and write a reason for both sides.")
      if (input.outcome === "refund_required" && !(input.amount && input.amount > 0)) fail("Enter the refund amount.")
      const decision = {
        outcome: input.outcome!,
        note: input.text!.trim(),
        at: now,
        ...(input.outcome === "refund_required" ? { amount: input.amount, due: addWorkingDays(new Date(), 3).toISOString() } : {}),
      }
      messages.push({ from: "aquenora", text: input.text!.trim(), at: now })
      Object.assign(update, { decision, messages, ...(input.outcome === "seller" ? { status: "resolved", resolved_at: new Date() } : { status: "escalated" }) })
      next = { ...d, decision: decision as DisputeRecord["decision"], messages, status: input.outcome === "seller" ? "resolved" : "escalated" }
      mails.push(buyerUpdateEmail(next, seller.name, "decision", link, cur), sellerUpdateEmail(next, seller, "decision", cur))
      break
    }
  }
  const saved = (await sellers.updateDisputes(update as never)) as unknown as DisputeRecord
  return new StepResponse({ dispute: toDisputeView(saved), mails })
})

export const disputeActionWorkflow = createWorkflow("dispute-action", function (input: DisputeActionInput) {
  const result = disputeActionStep(input)
  const notifications = transform({ result }, ({ result }) => mailsToNotifications(result.mails))
  sendNotificationsStep(notifications)
  return new WorkflowResponse(transform({ result }, ({ result }) => result.dispute))
})
