import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

// Public: the link in every campaign email. GET shows a confirm button (so email scanners that
// open links don't unsubscribe people by accident); POST unsubscribes, including the one-click
// POST that Gmail and Outlook send from their own "Unsubscribe" button.

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function page(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)}</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#1c1a17;">
<main style="max-width:420px;padding:32px 20px;text-align:center;"><div style="font-weight:bold;letter-spacing:0.08em;">AQENORA</div><div style="font-size:12px;font-style:italic;color:#7a7368;margin:4px 0 18px;">Illuminating possibilities. Connecting the world.</div>${body}</main></body></html>`
}

async function findContact(req: MedusaRequest) {
  const marketing: MarketingModuleService = req.scope.resolve(MARKETING_MODULE)
  const [contact] = await marketing.listMarketingContacts({ unsubscribe_token: req.params.token }, { take: 1 })
  if (!contact) {
    return null
  }
  const sellers: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const [seller] = await sellers.listSellers({ id: contact.seller_id }, { take: 1 })
  return { contact, shop: seller?.name ?? "this shop", marketing }
}

function notFound(res: MedusaResponse) {
  res.status(404).type("html").send(page("Link not found", `<h1 style="font-size:22px;">This link isn't valid</h1><p style="color:#5b554c;line-height:1.5;">It may have been copied incompletely. Use the Unsubscribe link at the bottom of the email.</p>`))
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const found = await findContact(req)
  if (!found) {
    return notFound(res)
  }
  const shop = escape(found.shop)
  if (!found.contact.subscribed) {
    return res.type("html").send(page("Unsubscribed", `<h1 style="font-size:22px;">You're already unsubscribed</h1><p style="color:#5b554c;line-height:1.5;">${shop} won't send you news or offers.</p>`))
  }
  res.type("html").send(
    page(
      "Unsubscribe",
      `<h1 style="font-size:22px;">Stop emails from ${shop}?</h1><p style="color:#5b554c;line-height:1.5;">You'll still get emails about orders you place.</p>
<form method="post"><button type="submit" style="margin-top:8px;border:none;border-radius:999px;background:#1c1a17;color:#fff;font-weight:bold;font-size:15px;padding:14px 24px;cursor:pointer;">Unsubscribe</button></form>`
    )
  )
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const found = await findContact(req)
  if (!found) {
    return notFound(res)
  }
  if (found.contact.subscribed) {
    await found.marketing.updateMarketingContacts({ id: found.contact.id, subscribed: false, unsubscribed_at: new Date() })
  }
  res.type("html").send(page("Unsubscribed", `<h1 style="font-size:22px;">You're unsubscribed</h1><p style="color:#5b554c;line-height:1.5;">${escape(found.shop)} won't send you news or offers any more.</p>`))
}
