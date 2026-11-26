// "Notify me when it's back": which waiting shoppers to email after a seller restocks, and the email.

import { shopUrl } from "./campaign-email"
import { madeToOrderDays, readOptions } from "./product-options"

/** Is this product (or this choice of its first option) available again? */
export function backInStock(metadata: Record<string, unknown> | null | undefined, choice: string): boolean {
  if (madeToOrderDays(metadata)) return true
  const o = readOptions(metadata)
  if (choice && o?.stock_per_choice) {
    const c = o.groups[0].choices.find((x) => x.label.toLowerCase() === choice.toLowerCase())
    return (c?.stock ?? 0) > 0
  }
  return Number(metadata?.stock ?? 0) > 0
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function backInStockEmail(input: { to: string; shopName: string; handle: string; productTitle: string; productHandle: string; choice: string; image?: string | null }) {
  const shop = shopUrl(input.handle)
  const link = shop ? `${shop.replace(/\?.*$/, "")}/p/${input.productHandle}${shop.includes("?") ? shop.slice(shop.indexOf("?")) : ""}` : null
  const what = `${input.productTitle}${input.choice ? ` (${input.choice})` : ""}`
  const subject = `It's back: ${what} at ${input.shopName}`
  const text = `Good news! ${what} is back in stock at ${input.shopName}.\n\n${link ? `Get it before it sells out again: ${link}\n\n` : ""}You asked us to tell you. We won't email you about it again.\n\nAQUENORA`
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;"><div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:18px;text-align:center;"><div style="font-weight:800;font-size:18px;">${esc(input.shopName)}</div><div style="font-size:11px;letter-spacing:3px;color:#cdbcf2;margin-top:3px;">ON AQUENORA</div></div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:22px;">
${input.image ? `<img src="${esc(input.image)}" alt="" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin-bottom:14px;">` : ""}
<h1 style="font-size:21px;margin:0 0 8px;">It's back in stock 🎉</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px;"><b>${esc(what)}</b> is available again at ${esc(input.shopName)}. Get it before it sells out again.</p>
${link ? `<p style="text-align:center;margin:0 0 16px;"><a href="${esc(link)}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;">Shop now</a></p>` : ""}
<p style="font-size:12.5px;color:#6b645a;margin:0;">You asked us to tell you. We won't email you about it again.</p>
</div></div></body></html>`
  return { to: input.to, subject, text, html }
}
