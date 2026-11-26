import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { appUrl, supportEmail } from "../lib/account-email"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

const email = (to: string, subject: string, text: string) => ({
  to,
  channel: "email",
  template: "aquenora-moderation",
  data: {
    subject,
    text: `${text}\n\nSee the rules: ${appUrl()}/seller-agreement\nQuestions? Reply to this email or write to ${supportEmail()}.\n\nAQUENORA`,
    html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1c1a17;max-width:520px;margin:0 auto;padding:24px 16px;"><div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:18px;text-align:center;font-weight:800;letter-spacing:4px;">AQUENORA</div><div style="background:#fff;border:1px solid #eee;border-radius:0 0 16px 16px;padding:22px;"><h1 style="font-size:19px;margin:0 0 10px;">${subject.replace(/</g, "&lt;")}</h1><p style="font-size:15px;line-height:1.5;">${text.replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p><p style="font-size:13px;color:#6b645a;">See the rules in the <a href="${appUrl()}/seller-agreement">Seller agreement</a>. Questions? Reply to this email.</p></div></body></html>`,
    reply_to: supportEmail(),
  },
})

// ---------------- a shopper reports a product ----------------

const reportProductStep = createStep(
  "report-product",
  async (input: { product_id: string; reason: string; note?: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "product", fields: ["id", "status", "seller.id"], filters: { id: input.product_id } })
    const p = data[0] as unknown as { id: string; status: string; seller?: { id: string } | null } | undefined
    if (!p?.seller || p.status !== "published") throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const report = await sellers.createProductReports({ product_id: p.id, seller_id: p.seller.id, reason: input.reason as never, note: input.note ?? null })
    return new StepResponse(report.id, report.id)
  },
  async (id, { container }) => {
    if (id) await container.resolve<SellerModuleService>(SELLER_MODULE).deleteProductReports(id)
  }
)

export const reportProductWorkflow = createWorkflow("report-product", function (input: { product_id: string; reason: string; note?: string }) {
  return new WorkflowResponse(reportProductStep(input))
})

// ---------------- AQUENORA hides a reported product, or dismisses the reports ----------------

const reviewReportStep = createStep(
  "review-report",
  async (input: { report_id: string; action: "hide" | "dismiss"; reason?: string }, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const report = await sellers.retrieveProductReport(input.report_id)
    // Every open report for the same product is settled together.
    const open = await sellers.listProductReports({ product_id: report.product_id, status: "open" }, { select: ["id"] })
    const ids = [...new Set([report.id, ...open.map((r) => r.id)])]
    await sellers.updateProductReports(ids.map((id) => ({ id, status: input.action === "hide" ? "actioned" : "dismissed" })) as never)
    if (input.action === "dismiss") return new StepResponse({ notify: null as null | { to: string; subject: string; text: string } })
    const products = container.resolve(Modules.PRODUCT)
    const product = await products.retrieveProduct(report.product_id)
    const reason = input.reason?.trim() || "It breaks AQUENORA's rules for what can be sold."
    await products.updateProducts(product.id, {
      metadata: { ...(product.metadata ?? {}), hidden_by_aquenora: { reason, at: new Date().toISOString() } },
    })
    const seller = await sellers.retrieveSeller(report.seller_id)
    return new StepResponse({
      notify: {
        to: seller.email,
        subject: `"${product.title}" has been hidden from your store`,
        text: `AQUENORA has hidden "${product.title}" from your store and from AQUENORA search.\n\nReason: ${reason}\n\nIf you think this is a mistake, reply to this email.`,
      },
    })
  }
)

export const reviewReportWorkflow = createWorkflow("review-report", function (input: { report_id: string; action: "hide" | "dismiss"; reason?: string }) {
  const result = reviewReportStep(input)
  const notifications = transform({ result }, ({ result }) => (result.notify ? [email(result.notify.to, result.notify.subject, result.notify.text)] : []))
  sendNotificationsStep(notifications)
  return new WorkflowResponse(true)
})

// ---------------- AQUENORA shows a hidden product again ----------------

const unhideProductStep = createStep("unhide-product", async (input: { product_id: string }, { container }) => {
  const products = container.resolve(Modules.PRODUCT)
  const product = await products.retrieveProduct(input.product_id)
  // Product metadata is merged on update, so the flag is cleared rather than left out.
  await products.updateProducts(product.id, { metadata: { ...(product.metadata ?? {}), hidden_by_aquenora: null } })
  return new StepResponse(true)
})

export const unhideProductWorkflow = createWorkflow("unhide-product", function (input: { product_id: string }) {
  return new WorkflowResponse(unhideProductStep(input))
})

// ---------------- AQUENORA suspends (or restores) a store ----------------

const suspendSellerStep = createStep(
  "suspend-seller",
  async (input: { seller_id: string; suspend: boolean; reason?: string }, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const seller = await sellers.retrieveSeller(input.seller_id)
    await sellers.updateSellers({
      id: seller.id,
      suspended_at: input.suspend ? new Date() : null,
      suspend_reason: input.suspend ? input.reason ?? null : null,
    })
    return new StepResponse({
      to: seller.email,
      subject: input.suspend ? `Your store ${seller.name} has been paused` : `Your store ${seller.name} is open again`,
      text: input.suspend
        ? `AQUENORA has paused your store. It's hidden from buyers and can't take payments for now.\n\nReason: ${input.reason}\n\nReply to this email to talk to us about it.`
        : "Your store is visible again and can take payments. Thank you for sorting things out.",
    })
  }
)

export const suspendSellerWorkflow = createWorkflow("suspend-seller", function (input: { seller_id: string; suspend: boolean; reason?: string }) {
  const result = suspendSellerStep(input)
  const notifications = transform({ result }, ({ result }) => [email(result.to, result.subject, result.text)])
  sendNotificationsStep(notifications)
  return new WorkflowResponse(true)
})
