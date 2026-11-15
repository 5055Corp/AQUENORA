// Emails about a person's AQUENORA account (not from a seller): password reset.

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

/** Where the app lives: https://app.<STORE_DOMAIN>, or APP_URL / localhost while developing. */
export function appUrl(): string {
  const domain = (process.env.STORE_DOMAIN ?? "").replace(/^\.+|\.+$/g, "")
  if (domain) return `https://app.${domain}`
  return (process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "")
}

export function resetPasswordLink(email: string, token: string): string {
  const u = new URL(`${appUrl()}/reset-password`)
  u.searchParams.set("token", token)
  u.searchParams.set("email", email)
  return u.toString()
}

/** Where replies to AQUENORA's own emails go. */
export const supportEmail = () => process.env.SUPPORT_EMAIL || "support@aquenora.com"

export function renderPasswordResetEmail(link: string) {
  const subject = "Reset your AQUENORA password"
  const text = `Someone asked to reset the password for your AQUENORA account.

Choose a new password here (the link works for 15 minutes):
${link}

If this wasn't you, ignore this email. Your password stays the same.
Questions? Reply to this email or write to ${supportEmail()}.

AQUENORA. Illuminating possibilities. Connecting the world.`
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;">
<div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:22px;text-align:center;font-weight:800;letter-spacing:4px;font-size:20px;">AQUENORA</div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;">
<h1 style="font-size:20px;margin:0 0 12px;">Reset your password</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 18px;">Someone asked to reset the password for your AQUENORA account. Tap the button to choose a new one. The link works for 15 minutes.</p>
<p style="text-align:center;margin:0 0 18px;"><a href="${escape(link)}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:999px;">Choose a new password</a></p>
<p style="font-size:13px;line-height:1.5;color:#6b645a;margin:0;">If this wasn't you, ignore this email. Your password stays the same. Questions? Reply to this email or write to <a href="mailto:${escape(supportEmail())}" style="color:#5B21B6;">${escape(supportEmail())}</a>.</p>
</div>
<p style="font-size:12px;color:#6b645a;text-align:center;margin:14px 0 0;"><em>Illuminating possibilities. Connecting the world.</em></p>
</div></body></html>`
  return { subject, text, html, reply_to: supportEmail() }
}
