// Disputes: a buyer's problem with an order. Sellers refund buyers directly (AQUENORA never pays
// out refunds). Rules and emails live here; the changes happen in workflows/disputes.ts.

import { MedusaError } from "@medusajs/framework/utils"
import { appUrl, supportEmail } from "./account-email"
import { money } from "./order-email"

export const REASONS = {
  not_arrived: "It hasn't arrived",
  wrong_item: "Wrong item",
  damaged: "Damaged",
  not_as_described: "Not as described",
  other: "Something else",
} as const
export type DisputeReason = keyof typeof REASONS

export type DisputeMessage = { from: "buyer" | "seller" | "aquenora"; text: string; at: string; files?: string[] }
export type DisputeRecord = {
  id: string
  order_id: string
  seller_id: string
  order_display_id: number
  buyer_email: string
  buyer_name: string | null
  reason: DisputeReason
  status: "open" | "replied" | "refunded" | "escalated" | "resolved"
  messages: DisputeMessage[]
  refund: { amount: number; note?: string; at: string; file?: string } | null
  decision: { outcome: "refund_required" | "seller"; note: string; amount?: number; due?: string; at: string } | null
  reply_by: string | Date
  resolved_at: string | Date | null
  created_at: string | Date
}

/** n working days (Mon–Fri) after `from`. */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from)
  let left = n
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1)
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) left--
  }
  return d
}

const MAX_FILE_BYTES = 1_500_000

/** Checks photos sent with a dispute (base64 JPEG/PNG/WebP, already shrunk in the browser). */
export function checkFiles(files: { mime_type: string; data: string }[] | undefined) {
  for (const f of files ?? []) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.mime_type)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Photos must be JPEG, PNG or WebP.")
    }
    if (Buffer.byteLength(f.data, "base64") > MAX_FILE_BYTES) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "That photo is too big. Try a smaller one.")
    }
  }
}

/** What the buyer, seller and admin see (no private data beyond what each already has). */
export function toDisputeView(d: DisputeRecord) {
  return {
    id: d.id,
    order_id: d.order_id,
    order_display_id: d.order_display_id,
    reason: d.reason,
    reason_label: REASONS[d.reason],
    status: d.status,
    messages: d.messages,
    refund: d.refund,
    decision: d.decision,
    reply_by: d.reply_by,
    resolved_at: d.resolved_at,
    created_at: d.created_at,
    // The buyer can ask AQUENORA to step in once the seller has answered, or the reply time has passed.
    can_escalate: d.status === "replied" || d.status === "refunded" || (d.status === "open" && new Date(d.reply_by).getTime() < Date.now()),
  }
}

const wrap = (title: string, body: string, button?: { href: string; label: string }) => `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;">
<div style="max-width:520px;margin:0 auto;padding:28px 16px;">
<div style="background:#0A0612;color:#fff;border-radius:16px 16px 0 0;padding:20px;text-align:center;font-weight:800;letter-spacing:4px;font-size:18px;">AQUENORA</div>
<div style="background:#fff;border-radius:0 0 16px 16px;padding:24px;">
<h1 style="font-size:20px;margin:0 0 12px;">${title}</h1>
${body}
${button ? `<p style="text-align:center;margin:18px 0;"><a href="${button.href}" style="display:inline-block;background:#5B21B6;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:999px;">${button.label}</a></p>` : ""}
<p style="font-size:13px;line-height:1.5;color:#6b645a;margin:0;">Questions? Reply to this email or write to ${supportEmail()}.</p>
</div></div></body></html>`
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const p = (s: string) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px;">${s}</p>`

export type Mail = { to: string; subject: string; text: string; html: string }

export function sellerNewDisputeEmail(d: DisputeRecord, seller: { email: string; name: string }, message: string): Mail {
  const due = new Date(d.reply_by).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })
  const subject = `Problem reported on order #${d.order_display_id}: reply by ${due}`
  const text = `${d.buyer_name || "Your buyer"} reported a problem with order #${d.order_display_id}: ${REASONS[d.reason]}.\n\n"${message}"\n\nPlease reply by ${due} in the AQUENORA app (Orders). If you agree they should get money back, send it to them directly and tap "Mark as refunded".\n\nOpen AQUENORA: ${appUrl()}`
  const html = wrap(`Problem reported on order #${d.order_display_id}`, p(`<b>${esc(d.buyer_name || "Your buyer")}</b> says: <b>${REASONS[d.reason]}</b>.`) + p(`“${esc(message)}”`) + p(`Please reply by <b>${due}</b> in Orders. If you agree they should get money back, send it to them directly and tap <b>Mark as refunded</b>.`), { href: appUrl(), label: "Open Orders" })
  return { to: seller.email, subject, text, html }
}

export function buyerUpdateEmail(d: DisputeRecord, shopName: string, what: "reply" | "refunded" | "decision", trackUrl: string | null, currency: string): Mail {
  const last = d.messages[d.messages.length - 1]
  const headline =
    what === "refunded"
      ? `${shopName} says they've refunded ${money(d.refund?.amount ?? 0, currency)}`
      : what === "decision"
        ? d.decision?.outcome === "refund_required"
          ? `AQUENORA has asked ${shopName} to refund you`
          : `AQUENORA has reviewed your order #${d.order_display_id}`
        : `${shopName} replied about order #${d.order_display_id}`
  const detail =
    what === "refunded"
      ? `${d.refund?.note ? `“${d.refund.note}” ` : ""}Please check your account, then tap “I got my refund” on your order page.`
      : what === "decision"
        ? d.decision?.note ?? ""
        : `“${last?.text ?? ""}”`
  const text = `${headline}.\n\n${detail}\n${trackUrl ? `\nSee your order: ${trackUrl}\n` : ""}`
  const html = wrap(headline, p(esc(detail)), trackUrl ? { href: trackUrl, label: "See my order" } : undefined)
  return { to: d.buyer_email, subject: `${headline} · order #${d.order_display_id}`, text, html }
}

export function sellerUpdateEmail(d: DisputeRecord, seller: { email: string }, what: "message" | "escalated" | "decision" | "confirmed", currency: string): Mail {
  const headline =
    what === "escalated"
      ? `The buyer asked AQUENORA to look at order #${d.order_display_id}`
      : what === "confirmed"
        ? `The buyer confirmed your refund on order #${d.order_display_id}`
        : what === "decision"
          ? d.decision?.outcome === "refund_required"
            ? `Please refund ${money(d.decision.amount ?? 0, currency)} for order #${d.order_display_id}`
            : `AQUENORA closed the problem on order #${d.order_display_id} in your favour`
          : `New message about order #${d.order_display_id}`
  const due = d.decision?.due ? new Date(d.decision.due).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }) : ""
  const detail =
    what === "decision"
      ? `${d.decision?.note ?? ""}${d.decision?.outcome === "refund_required" ? ` Send the refund to the buyer by ${due} and tap "Mark as refunded" in Orders. If it isn't refunded by then, your store will be paused.` : ""}`
      : what === "message"
        ? `“${d.messages[d.messages.length - 1]?.text ?? ""}”`
        : what === "escalated"
          ? "The AQUENORA team will look at what you and the buyer have said and decide. You can still add a message in Orders."
          : "This problem is now closed. Thank you for sorting it out."
  const text = `${headline}.\n\n${detail}\n\nOpen AQUENORA: ${appUrl()}`
  return { to: seller.email, subject: headline, text, html: wrap(headline, p(esc(detail)), { href: appUrl(), label: "Open Orders" }) }
}
