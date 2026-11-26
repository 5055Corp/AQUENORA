import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { supportEmail } from "../lib/account-email"
import { extendFrom } from "../lib/pro-billing"
import { referralRewardEmail } from "../lib/referrals"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

type S = { id: string; name: string; email: string; referred_by: string | null; referral_rewarded_at: Date | null; pro_paid_until: Date | null; suspended_at: Date | null }

/** After a paid order: if this seller was invited and hasn't been rewarded, both get a free Pro month (once). */
const rewardReferralStep = createStep("reward-referral", async (input: { seller_id: string }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const invited = (await sellers.retrieveSeller(input.seller_id)) as unknown as S
  if (!invited.referred_by || invited.referral_rewarded_at) return new StepResponse([] as ReturnType<typeof referralRewardEmail>[], null)
  const inviter = (await sellers.retrieveSeller(invited.referred_by).catch(() => null)) as unknown as S | null
  const now = new Date()
  const before = [{ id: invited.id, pro_paid_until: invited.pro_paid_until, referral_rewarded_at: null }] as Record<string, unknown>[]
  const invitedUntil = extendFrom(invited.pro_paid_until, now)
  await sellers.updateSellers({ id: invited.id, pro_paid_until: invitedUntil, referral_rewarded_at: now } as never)
  const mails = [referralRewardEmail({ to: invited.email, shopName: invited.name, otherShop: inviter?.name ?? "a friend", invited: true, until: invitedUntil })]
  if (inviter && !inviter.suspended_at) {
    const inviterUntil = extendFrom(inviter.pro_paid_until, now)
    before.push({ id: inviter.id, pro_paid_until: inviter.pro_paid_until })
    await sellers.updateSellers({ id: inviter.id, pro_paid_until: inviterUntil } as never)
    mails.push(referralRewardEmail({ to: inviter.email, shopName: inviter.name, otherShop: invited.name, invited: false, until: inviterUntil }))
  }
  return new StepResponse(mails, before)
}, async (before, { container }) => {
  if (before?.length) await container.resolve<SellerModuleService>(SELLER_MODULE).updateSellers(before as never)
})

export const rewardReferralWorkflow = createWorkflow("reward-referral", function (input: { seller_id: string }) {
  const mails = rewardReferralStep(input)
  const notifications = transform({ mails }, ({ mails }) =>
    mails.map((m) => ({ to: m.to, channel: "email", template: "aquenora-referral-reward", data: { subject: m.subject, text: m.text, html: m.html, reply_to: supportEmail() } }))
  )
  sendNotificationsStep(notifications)
  return new WorkflowResponse(transform({ mails }, ({ mails }) => mails.length > 0))
})
