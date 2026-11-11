import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RESEARCH_MODULE } from "../../../modules/research"
import type ResearchModuleService from "../../../modules/research/service"

type Answer = { id: string; section: string; question: string; answer: string | string[] }

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v)
  // Quote everything; neutralise spreadsheet formulas.
  return `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`
}

/**
 * GET /admin/interviews            all answered interviews, newest first, plus a summary
 * GET /admin/interviews?format=csv  the same as a spreadsheet (one row per interview)
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const research = req.scope.resolve<ResearchModuleService>(RESEARCH_MODULE)
  const rows = await research.listSellerInterviews({}, { order: { created_at: "DESC" }, take: 5000 })
  const interviews = rows.map((r) => ({
    id: r.id,
    created_at: r.created_at,
    name: r.name,
    email: r.email,
    phone: r.phone,
    contact_ok: r.contact_ok,
    wants_early_access: r.wants_early_access,
    country: r.country,
    source: r.source,
    version: r.version,
    answers: (r.answers as unknown as Answer[]) ?? [],
  }))

  if (req.query.format === "csv") {
    // One column per question, in the order first seen.
    const cols = new Map<string, string>()
    for (const i of interviews) {
      for (const a of i.answers) {
        if (!cols.has(a.id)) {
          cols.set(a.id, a.question)
        }
      }
    }
    const fixed = ["Date", "Name", "Email", "Phone", "OK to contact", "Early access", "Country", "Source"]
    const lines = [[...fixed, ...cols.values()].map(csvCell).join(",")]
    for (const i of interviews) {
      const by = new Map(i.answers.map((a) => [a.id, a.answer]))
      lines.push(
        [
          new Date(i.created_at).toISOString().slice(0, 16).replace("T", " "),
          i.name, i.email, i.phone, i.contact_ok ? "yes" : "no", i.wants_early_access ? "yes" : "no", i.country, i.source,
          ...[...cols.keys()].map((k) => by.get(k)),
        ].map(csvCell).join(",")
      )
    }
    res.setHeader("content-type", "text/csv; charset=utf-8")
    res.setHeader("content-disposition", `attachment; filename="aquenora-seller-interviews-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send("﻿" + lines.join("\r\n"))
    return
  }

  // Summary: how often each choice was picked, for multiple-choice questions.
  const tallies = new Map<string, { question: string; section: string; counts: Map<string, number>; answered: number }>()
  for (const i of interviews) {
    for (const a of i.answers) {
      const values = Array.isArray(a.answer) ? a.answer : null
      if (!values) {
        continue
      }
      const t = tallies.get(a.id) ?? { question: a.question, section: a.section, counts: new Map(), answered: 0 }
      t.answered++
      for (const v of values) {
        t.counts.set(v, (t.counts.get(v) ?? 0) + 1)
      }
      tallies.set(a.id, t)
    }
  }
  const summary = [...tallies.entries()].map(([id, t]) => ({
    id,
    section: t.section,
    question: t.question,
    answered: t.answered,
    choices: [...t.counts.entries()].sort((a, b) => b[1] - a[1]).map(([choice, count]) => ({ choice, count })),
  }))

  res.json({
    count: interviews.length,
    early_access: interviews.filter((i) => i.wants_early_access).length,
    summary,
    interviews,
  })
}
