import { appUrl, supportEmail } from "./account-email"

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

/** The email a seller gets when AQUENORA approves or rejects their verification. */
export function renderVerificationEmail(input: { shopName: string; approved: boolean; reason?: string }) {
  const subject = input.approved ? "Your AQUENORA store is verified ✓" : "Your AQUENORA verification needs another look"
  const body = input.approved
    ? `Good news: ${input.shopName} is now a verified AQUENORA seller. You can take payments, your store can appear in AQUENORA search, and buyers will see the Verified seller badge.`
    : `We couldn't verify ${input.shopName} yet. Reason: ${input.reason ?? "the details didn't match"}. Open the AQUENORA app, go to Settings → Verify your business, fix it and send it again.`
  const link = appUrl()
  const text = `${body}\n\nOpen AQUENORA: ${link}\n\nQuestions? Reply to this email or write to ${supportEmail()}.\n\nAQUENORA. Illuminating possibilities. Connecting the world.`
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;">
<div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:22px;text-align:center;font-weight:800;letter-spacing:4px;font-size:20px;">AQUENORA</div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;">
<h1 style="font-size:20px;margin:0 0 12px;">${input.approved ? "You're verified ✓" : "Verification needs another look"}</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 18px;">${escape(body)}</p>
<p style="text-align:center;margin:0 0 18px;"><a href="${escape(link)}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:999px;">Open AQUENORA</a></p>
<p style="font-size:13px;line-height:1.5;color:#6b645a;margin:0;">Questions? Reply to this email or write to <a href="mailto:${escape(supportEmail())}" style="color:#5B21B6;">${escape(supportEmail())}</a>.</p>
</div></div></body></html>`
  return { subject, text, html, reply_to: supportEmail() }
}
