// "You left something in your bag": one reminder to a shopper who started paying and didn't finish.

import { shopUrl } from "./campaign-email"

/** Wait this long after checkout started before reminding (they may still be paying). */
export const REMIND_AFTER_MS = 60 * 60 * 1000
/** Don't remind about checkouts older than this. */
export const REMIND_WITHIN_MS = 24 * 60 * 60 * 1000
/** At most one reminder per shopper per shop in this time. */
export const REMIND_GAP_MS = 7 * 24 * 60 * 60 * 1000

export type BagItem = { product_id: string; title: string; quantity: number; unit_price: number; options?: { name: string; value: string }[]; note?: string }

/** The store page's bag, as it keeps it (see lineKey in app/src/storefront/StorePage.tsx). */
export function bagFromItems(items: BagItem[]): Record<string, number> {
  const bag: Record<string, number> = {}
  for (const i of items) {
    const choices = (i.options ?? []).map((o) => o.value)
    const note = i.note ?? ""
    const key = choices.length || note ? JSON.stringify([i.product_id, choices, note]) : i.product_id
    bag[key] = (bag[key] ?? 0) + i.quantity
  }
  return bag
}

/** A link to the shop that puts these items back in the shopper's bag. */
export function resumeLink(handle: string, items: BagItem[]): string | null {
  const shop = shopUrl(handle)
  if (!shop) return null
  const bag = Buffer.from(JSON.stringify(bagFromItems(items))).toString("base64url")
  return `${shop}${shop.includes("?") ? "&" : "?"}bag=${bag}`
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function abandonedBagEmail(input: {
  to: string
  name: string
  shopName: string
  handle: string
  items: BagItem[]
  total: string
  image?: string | null
}) {
  const link = resumeLink(input.handle, input.items)
  const first = input.name.trim().split(/\s+/)[0] || "there"
  const lines = input.items.map((i) => `${i.quantity} × ${i.title}`)
  const subject = `You left something in your bag at ${input.shopName}`
  const text = `Hi ${first},\n\nYou were about to buy from ${input.shopName} but didn't finish paying:\n\n${lines.join("\n")}\n\nTotal: ${input.total}\n\n${link ? `Your bag is saved. Finish here: ${link}\n\n` : ""}If something went wrong with the payment, just try again. This is the only reminder we'll send.\n\nAQUENORA`
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;"><div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:18px;text-align:center;"><div style="font-weight:800;font-size:18px;">${esc(input.shopName)}</div><div style="font-size:11px;letter-spacing:3px;color:#cdbcf2;margin-top:3px;">ON AQUENORA</div></div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:22px;">
<h1 style="font-size:21px;margin:0 0 8px;">Still thinking it over, ${esc(first)}?</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 14px;">You didn't finish paying at ${esc(input.shopName)}. Your bag is saved.</p>
${input.image ? `<img src="${esc(input.image)}" alt="" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;margin-bottom:12px;">` : ""}
<table style="width:100%;border-collapse:collapse;font-size:14.5px;margin:0 0 14px;">${lines.map((l) => `<tr><td style="padding:7px 0;border-bottom:1px solid #eee;">${esc(l)}</td></tr>`).join("")}<tr><td style="padding:9px 0;font-weight:700;">Total: ${esc(input.total)}</td></tr></table>
${link ? `<p style="text-align:center;margin:0 0 16px;"><a href="${esc(link)}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;">Finish my order</a></p>` : ""}
<p style="font-size:12.5px;color:#6b645a;margin:0;">If something went wrong with the payment, just try again. This is the only reminder we'll send.</p>
</div></div></body></html>`
  return { to: input.to, subject, text, html }
}
