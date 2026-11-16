import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/** GET /admin/verifications?status=pending: sellers to check (default: waiting), newest first. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const status = typeof req.query.status === "string" ? req.query.status : "pending"
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: ["id", "name", "handle", "email", "country_code", "category", "verification_status", "verification", "verified_at", "payout", "created_at"],
    // (verification_status is new, so the generated filter types may not list it yet.)
    filters: (status === "all" ? {} : { verification_status: status }) as never,
  })
  type Row = { verification: { submitted_at?: string } | null; created_at: string | Date }
  const sellers = (data as unknown as Row[]).sort((a, b) =>
    String(b.verification?.submitted_at ?? b.created_at).localeCompare(String(a.verification?.submitted_at ?? a.created_at))
  )
  res.json({ sellers })
}
