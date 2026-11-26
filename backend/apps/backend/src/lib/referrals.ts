// Referrals: a seller invites another; when the new store makes its first sale, both get a free Pro month.

import { appUrl, supportEmail } from "./account-email"

/** The invite link: the app's sign-up with the inviter's web address. */
export const inviteLink = (handle: string) => `${appUrl()}/?ref=${encodeURIComponent(handle)}`

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function referralRewardEmail(input: { to: string; shopName: string; otherShop: string; invited: boolean; until: Date }) {
  const date = input.until.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
  const why = input.invited
    ? `You joined AQUENORA with ${input.otherShop}'s invite and made your first sale.`
    : `${input.otherShop} joined AQUENORA with your invite and just made their first sale.`
  const subject = "You've got a free month of AQUENORA Pro 🎉"
  const text = `Congratulations, ${input.shopName}!\n\n${why} You both get a free month of Pro: lower fees, your own domain and more.\n\nPro is on until ${date}. Nothing to pay and no card needed.\n\nInvite more sellers from Settings → Invite a seller: every one who makes a first sale gives you another free month.\n\nQuestions? Write to ${supportEmail()}.\n\nAQUENORA`
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;"><div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:22px;text-align:center;font-weight:800;letter-spacing:4px;font-size:20px;">AQUENORA</div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;">
<h1 style="font-size:21px;margin:0 0 10px;">A free month of Pro 🎉</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">${esc(why)} You both get a free month of Pro.</p>
<p style="font-size:15px;line-height:1.5;margin:0 0 14px;background:#f1ebfd;color:#3b1680;border-radius:12px;padding:12px 14px;"><b>Pro is on until ${date}.</b> Nothing to pay and no card needed.</p>
<p style="font-size:13px;color:#6b645a;margin:0;">Invite more sellers from Settings → Invite a seller. Every one who makes a first sale gives you another free month.</p>
</div></div></body></html>`
  return { to: input.to, subject, text, html }
}
