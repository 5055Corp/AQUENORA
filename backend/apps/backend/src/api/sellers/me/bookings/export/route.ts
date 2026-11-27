import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { sellerBookings } from "../../../../../lib/booking-flow"
import { bookingSettingsOf, formatWhen, owedOf } from "../../../../../lib/bookings"
import { resolvePlan } from "../../../../../lib/plans"
import { SELLER_MODULE } from "../../../../../modules/seller"
import type SellerModuleService from "../../../../../modules/seller/service"

const cell = (v: unknown) => {
  const s = String(v ?? "")
  // Spreadsheet-safe: quote, and stop formulas (=, +, -, @) from running.
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
}

/** GET /sellers/me/bookings/export?from=&to=: a spreadsheet (CSV) of bookings and money. Pro. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const seller = await req.scope.resolve<SellerModuleService>(SELLER_MODULE).retrieveSeller(req.auth_context.actor_id)
  const plan = await resolvePlan(req.scope, seller as never)
  if (plan.plan !== "pro") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "The bookings spreadsheet is part of Pro.")
  const settings = bookingSettingsOf(seller as never)
  const now = Date.now()
  const from = new Date(typeof req.query.from === "string" ? req.query.from : now - 365 * 86400000)
  const to = new Date(typeof req.query.to === "string" ? req.query.to : now + 365 * 86400000)
  const rows = await sellerBookings(req.scope, seller.id, from, to)
  const lines = [
    ["Date", "Time", "Service", "Customer", "Phone", "Email", "Status", "Price", "Paid online", "To pay at appointment", "Tips", "Refund due", "Refunded"].map(cell).join(","),
    ...rows.map((b) => {
      const w = formatWhen(new Date(b.starts_at), settings.timezone)
      return [w.date, w.time, b.service_name, b.customer_name, b.phone, b.email, b.status, Number(b.price), Number(b.paid), b.status === "confirmed" ? owedOf(b) : 0, Number(b.tips), Number(b.refund_due), b.refunded_at ? "yes" : ""].map(cell).join(",")
    }),
  ]
  res.setHeader("Content-Type", "text/csv; charset=utf-8")
  res.setHeader("Content-Disposition", `attachment; filename="${seller.handle}-bookings.csv"`)
  res.send("﻿" + lines.join("\r\n") + "\r\n")
}
