import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { submitSellerInterviewWorkflow } from "../../../workflows/submit-seller-interview"
import type { SubmitInterviewBody } from "../../sellers/validators"

// A light limit per visitor address: enough for a few people sharing one phone or office.
const WINDOW = 60 * 60 * 1000
const MAX_PER_WINDOW = 6
const recent = new Map<string, number[]>()

function tooMany(ip: string, now = Date.now()): boolean {
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW)
  times.push(now)
  recent.set(ip, times)
  if (recent.size > 10000) {
    recent.clear()
  }
  return times.length > MAX_PER_WINDOW
}

/** POST /store/interviews: a potential seller's answers to the AQUENORA seller interview. */
export async function POST(req: MedusaRequest<SubmitInterviewBody>, res: MedusaResponse) {
  const body = req.validatedBody
  // Bots fill the hidden "website" field; pretend it worked.
  if (body.website) {
    res.json({ ok: true })
    return
  }
  const ip = (String(req.headers["x-forwarded-for"] ?? "").split(",")[0] || req.socket.remoteAddress || "?").trim()
  if (tooMany(ip)) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Thanks, we already have your answers. Please try again later if you meant to send more.")
  }
  const keepContact = body.contact_ok || body.wants_early_access
  await submitSellerInterviewWorkflow(req.scope).run({
    input: {
    answers: body.answers as unknown as Record<string, unknown>,
    name: keepContact ? body.name || null : null,
    email: keepContact ? body.email || null : null,
    phone: keepContact ? body.phone || null : null,
    contact_ok: body.contact_ok,
    wants_early_access: body.wants_early_access,
    country: body.country || null,
    source: body.source || null,
      version: body.version,
    },
  })
  res.json({ ok: true })
}
