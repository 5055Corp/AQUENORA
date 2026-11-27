import { Modules } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { supportEmail } from "../lib/account-email"
import { abandonedBagEmail, REMIND_AFTER_MS, REMIND_GAP_MS, REMIND_WITHIN_MS, type BagItem } from "../lib/abandoned-bag"
import { money } from "../lib/order-email"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

type Mail = ReturnType<typeof abandonedBagEmail>
type CheckoutRow = { id: string; seller_id: string; status: string; amount: unknown; currency_code: string; created_at: Date | string; reminded_at: Date | string | null; data: { email: string; name: string; items: BagItem[] } }

/**
 * Finds checkouts the shopper started 1 to 24 hours ago and never paid for, and emails one reminder
 * per shopper per shop (none if they paid later, or were reminded by that shop in the last 7 days).
 */
const findAbandonedBagsStep = createStep("find-abandoned-bags", async (input: { now?: string }, { container }) => {
  const now = input.now ? new Date(input.now).getTime() : Date.now()
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const due = (await sellers.listCheckouts(
    { status: "pending", reminded_at: null, created_at: { $gte: new Date(now - REMIND_WITHIN_MS), $lte: new Date(now - REMIND_AFTER_MS) } },
    { take: 500, order: { created_at: "DESC" } }
  )) as unknown as CheckoutRow[]
  if (!due.length) return new StepResponse([] as Mail[], [] as string[])

  // One reminder per shopper per shop: the latest checkout; every one of theirs is marked as handled.
  const groups = new Map<string, CheckoutRow[]>()
  for (const c of due) {
    const key = `${c.seller_id}|${c.data?.email}`
    if (!c.data?.email) continue
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const mails: Mail[] = []
  const handled: string[] = []
  const products = container.resolve(Modules.PRODUCT)
  for (const rows of groups.values()) {
    const latest = rows[0]
    handled.push(...rows.map((r) => r.id))
    const recent = (await sellers.listCheckouts(
      { seller_id: latest.seller_id, created_at: { $gte: new Date(now - REMIND_GAP_MS) } },
      { take: 1000, select: ["id", "status", "created_at", "reminded_at", "data"] }
    )) as unknown as CheckoutRow[]
    const theirs = recent.filter((r) => r.data?.email === latest.data.email)
    // Paid after starting this one, or already reminded recently: leave them alone.
    if (theirs.some((r) => r.status === "paid" && new Date(r.created_at).getTime() >= new Date(rows[rows.length - 1].created_at).getTime())) continue
    if (theirs.some((r) => r.reminded_at && now - new Date(r.reminded_at).getTime() < REMIND_GAP_MS)) continue
    const seller = await sellers.retrieveSeller(latest.seller_id).catch(() => null)
    if (!seller || seller.suspended_at) continue
    const items = latest.data.items ?? []
    if (!items.length) continue
    const [first] = await products.listProducts({ id: items[0].product_id }, { select: ["id", "thumbnail"] }).catch(() => [])
    mails.push(
      abandonedBagEmail({
        to: latest.data.email,
        name: latest.data.name ?? "",
        shopName: seller.name,
        handle: seller.handle,
        items,
        total: money(Number(latest.amount), latest.currency_code),
        image: first?.thumbnail ?? null,
      })
    )
  }
  const at = new Date(now)
  await sellers.updateCheckouts(handled.map((id) => ({ id, reminded_at: at })))
  return new StepResponse(mails, handled)
}, async (handled, { container }) => {
  if (handled?.length) await container.resolve<SellerModuleService>(SELLER_MODULE).updateCheckouts(handled.map((id) => ({ id, reminded_at: null })))
})

export const remindAbandonedBagsWorkflow = createWorkflow("remind-abandoned-bags", function (input: { now?: string }) {
  const mails = findAbandonedBagsStep(input)
  const notifications = transform({ mails }, ({ mails }) =>
    mails.map((m) => ({ to: m.to, channel: "email", template: "aquenora-abandoned-bag", data: { subject: m.subject, text: m.text, html: m.html, reply_to: supportEmail() } }))
  )
  sendNotificationsStep(notifications)
  return new WorkflowResponse(transform({ mails }, ({ mails }) => mails.length))
})
