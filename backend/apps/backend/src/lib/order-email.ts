// The buyer's "order confirmed" email, sent from orders@ once a payment is confirmed.

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")

/** Who order emails come from. */
export const ordersFrom = () => process.env.ORDERS_EMAIL_FROM || "AQUENORA Orders <orders@aquenora.com>"

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency.toUpperCase()} ${Math.round(amount).toLocaleString("en")}`
  }
}

export function renderOrderConfirmation(input: {
  shopName: string
  buyerName: string
  orderNo: number
  currency: string
  items: { title: string; quantity: number; unit_price: number; note?: string }[]
  shipping?: { name: string; price: number; days?: string } | null
  pickup: boolean
  madeToOrderDays: number | null
  trackUrl: string | null
}) {
  const total = input.items.reduce((a, i) => a + i.quantity * i.unit_price, 0) + (input.shipping?.price ?? 0)
  const first = input.buyerName.trim().split(/\s+/)[0] || "there"
  const subject = `Order #${input.orderNo} confirmed · ${input.shopName}`
  const next = input.madeToOrderDays
    ? `${input.shopName} is making your order now. It should be ready in about ${input.madeToOrderDays} ${input.madeToOrderDays === 1 ? "day" : "days"}.`
    : input.pickup
      ? `${input.shopName} will let you know when it's ready to pick up.`
      : `${input.shopName} is packing your order and will send it soon.`
  const lines = input.items.map((i) => `${i.quantity} × ${i.title}: ${money(i.quantity * i.unit_price, input.currency)}${i.note ? `\n   Your note: ${i.note}` : ""}`)
  const text = `Hi ${first},

Thank you! ${input.shopName} has your order #${input.orderNo} and your payment went through.

${lines.join("\n")}${input.shipping ? `\n${input.shipping.name}: ${money(input.shipping.price, input.currency)}` : ""}
Total paid: ${money(total, input.currency)}

${next}
${input.trackUrl ? `\nTrack your order: ${input.trackUrl}\n` : ""}
Questions about your order? Reply to this email and the AQUENORA team will help.

AQUENORA. Illuminating possibilities. Connecting the world.`
  const rows = input.items
    .map((i) => `<tr><td style="padding:8px 0;font-size:15px;line-height:1.4;">${i.quantity} × ${escape(i.title)}${i.note ? `<br><span style="color:#6b645a;font-size:13px;">Your note: ${escape(i.note)}</span>` : ""}</td><td style="padding:8px 0;text-align:right;font-size:15px;white-space:nowrap;vertical-align:top;">${money(i.quantity * i.unit_price, input.currency)}</td></tr>`)
    .join("")
  const html = `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;">
<div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:20px;text-align:center;"><div style="font-weight:800;font-size:19px;">${escape(input.shopName)}</div><div style="font-size:11px;letter-spacing:3px;color:#cdbcf2;margin-top:4px;">ON AQUENORA</div></div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;">
<h1 style="font-size:21px;margin:0 0 8px;">Order #${input.orderNo} confirmed ✓</h1>
<p style="font-size:15px;line-height:1.5;margin:0 0 16px;">Hi ${escape(first)}, thank you! Your payment went through. ${escape(next)}</p>
<table style="width:100%;border-collapse:collapse;border-top:1px solid #eee;border-bottom:1px solid #eee;">${rows}${input.shipping ? `<tr><td style="padding:8px 0;font-size:14px;color:#6b645a;">${escape(input.shipping.name)}</td><td style="padding:8px 0;text-align:right;font-size:14px;color:#6b645a;">${money(input.shipping.price, input.currency)}</td></tr>` : ""}</table>
<p style="font-size:16px;font-weight:700;text-align:right;margin:12px 0 20px;">Total paid: ${money(total, input.currency)}</p>
${input.trackUrl ? `<p style="text-align:center;margin:0 0 18px;"><a href="${escape(input.trackUrl)}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:999px;">Track my order</a></p>` : ""}
<p style="font-size:13px;line-height:1.5;color:#6b645a;margin:0;">Questions about your order? Reply to this email and the AQUENORA team will help.</p>
</div>
<p style="text-align:center;font-size:11px;letter-spacing:3px;color:#7a7368;margin:16px 0 0;">AQUENORA</p>
</div></body></html>`
  return { subject, text, html }
}
