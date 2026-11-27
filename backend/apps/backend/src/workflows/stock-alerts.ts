import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { supportEmail } from "../lib/account-email"
import { backInStock, backInStockEmail } from "../lib/stock-alerts"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

// ---------------- a shopper asks to be told ----------------

const createStockAlertStep = createStep(
  "create-stock-alert",
  async (input: { product_id: string; email: string; choice?: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({ entity: "product", fields: ["id", "status", "metadata", "seller.id"], filters: { id: input.product_id } })
    const p = data[0] as unknown as { id: string; status: string; metadata: Record<string, unknown> | null; seller?: { id: string } | null } | undefined
    if (!p?.seller || p.status !== "published" || p.metadata?.hidden_by_aquenora) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found.")
    const choice = input.choice?.trim() ?? ""
    if (backInStock(p.metadata, choice)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "It's in stock now. You can buy it straight away.")
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const email = input.email.trim().toLowerCase()
    const [existing] = await sellers.listStockAlerts({ product_id: p.id, email, choice, status: "waiting" })
    if (existing) return new StepResponse(existing.id, null as string | null)
    const made = await sellers.createStockAlerts({ product_id: p.id, seller_id: p.seller.id, email, choice })
    return new StepResponse(made.id, made.id as string | null)
  },
  async (id, { container }) => {
    if (id) await container.resolve<SellerModuleService>(SELLER_MODULE).deleteStockAlerts(id)
  }
)

export const createStockAlertWorkflow = createWorkflow("create-stock-alert", function (input: { product_id: string; email: string; choice?: string }) {
  return new WorkflowResponse(createStockAlertStep(input))
})

// ---------------- after a seller restocks: email everyone waiting, once ----------------

const notifyRestockStep = createStep("notify-restock", async (input: { product_id: string }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const waiting = await sellers.listStockAlerts({ product_id: input.product_id, status: "waiting" }, { take: 1000 })
  if (!waiting.length) return new StepResponse([] as ReturnType<typeof backInStockEmail>[])
  const product = await container.resolve(Modules.PRODUCT).retrieveProduct(input.product_id)
  const ready = waiting.filter((a) => backInStock(product.metadata, a.choice))
  if (!ready.length) return new StepResponse([] as ReturnType<typeof backInStockEmail>[])
  const seller = await sellers.retrieveSeller(ready[0].seller_id)
  await sellers.updateStockAlerts(ready.map((a) => ({ id: a.id, status: "sent" as const })))
  return new StepResponse(
    ready.map((a) =>
      backInStockEmail({ to: a.email, shopName: seller.name, handle: seller.handle, productTitle: product.title, productHandle: product.handle, choice: a.choice, image: product.thumbnail })
    )
  )
})

export const notifyRestockWorkflow = createWorkflow("notify-restock", function (input: { product_id: string }) {
  const mails = notifyRestockStep(input)
  const notifications = transform({ mails }, ({ mails }) =>
    mails.map((m) => ({ to: m.to, channel: "email", template: "aquenora-back-in-stock", data: { subject: m.subject, text: m.text, html: m.html, reply_to: supportEmail() } }))
  )
  sendNotificationsStep(notifications)
  return new WorkflowResponse(transform({ mails }, ({ mails }) => mails.length))
})
