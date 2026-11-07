// Builds a campaign email (HTML + plain text) from what the seller typed.

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

/** "{name}" becomes the buyer's first name, or "there" if we don't know it. */
export function personalize(text: string, name: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0]
  return text.replace(/\{name\}/gi, first || "there")
}

export function renderCampaignEmail(input: {
  shopName: string
  subject: string
  message: string
  recipientName: string | null
  storeUrl: string | null
  unsubscribeUrl: string
}) {
  const subject = personalize(input.subject, input.recipientName)
  const message = personalize(input.message, input.recipientName)
  const paragraphs = message
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("")
  const shop = escape(input.shopName)
  const footer = `You're getting this because you bought from ${input.shopName} and said yes to their news and offers.`

  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;">
<tr><td style="padding:28px 28px 8px;font-size:22px;font-weight:bold;">${shop}</td></tr>
<tr><td style="padding:8px 28px 8px;font-size:16px;">${paragraphs}</td></tr>
${input.storeUrl ? `<tr><td style="padding:0 28px 28px;"><a href="${escape(input.storeUrl)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:999px;">Visit the shop</a></td></tr>` : ""}
</table>
<p style="max-width:560px;font-size:12px;line-height:1.5;color:#6b645a;margin:16px auto 0;">${escape(footer)}<br><a href="${escape(input.unsubscribeUrl)}" style="color:#6b645a;">Unsubscribe</a> &middot; Sent with AQENORA</p>
</td></tr></table></body></html>`

  const text = `${message}\n\n${input.storeUrl ? `Visit the shop: ${input.storeUrl}\n\n` : ""}--\n${footer}\nUnsubscribe: ${input.unsubscribeUrl}`

  return {
    subject,
    html,
    text,
    // Lets Gmail, Outlook and others show their own "Unsubscribe" button (one click, no login).
    headers: {
      "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  }
}

/** Public base URL of this server, used in unsubscribe links. */
export function publicApiUrl(): string {
  return (process.env.MEDUSA_BACKEND_URL || "http://localhost:9000").replace(/\/+$/, "")
}

/** Link to a shop's store page: https://<handle>.<STORE_DOMAIN> once the domain is live, else STORE_PAGE_URL?shop=. */
export function shopUrl(handle: string): string | null {
  const domain = (process.env.STORE_DOMAIN ?? "").replace(/^\.+|\.+$/g, "")
  if (domain) {
    return `https://${handle}.${domain}`
  }
  const page = process.env.STORE_PAGE_URL
  return page ? `${page}${page.includes("?") ? "&" : "?"}shop=${encodeURIComponent(handle)}` : null
}
