import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui"
import { Fragment, useEffect, useState } from "react"

type Answer = { id: string; section: string; question: string; answer: string | string[] }
type Interview = {
  id: string
  created_at: string
  name: string | null
  email: string | null
  phone: string | null
  contact_ok: boolean
  wants_early_access: boolean
  country: string | null
  source: string | null
  answers: Answer[]
}
type Summary = { id: string; section: string; question: string; answered: number; choices: { choice: string; count: number }[] }
type Data = { count: number; early_access: number; summary: Summary[]; interviews: Interview[] }

/** The questions most worth a glance first. */
const HEADLINE = ["challenges", "sell_where", "features_must", "pricing_model", "pay_methods", "sell_abroad"]

const show = (a: string | string[]) => (Array.isArray(a) ? a.join(", ") : a)

/** Answers to the seller interview at app.aquenora.com/interview (market research). */
const SellerInterviewsPage = () => {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState("")
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    fetch("/admin/interviews", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Could not load (${res.status})`)
        }
        setData(await res.json())
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const headline = data ? HEADLINE.map((id) => data.summary.find((s) => s.id === id)).filter((s): s is Summary => !!s) : []

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div>
          <Heading>Seller interviews</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Answers from app.aquenora.com/interview. Add ?ref=whatsapp (or instagram, etc.) to the link to see where answers come from.
          </Text>
        </div>
        <Button variant="secondary" size="small" asChild>
          <a href="/admin/interviews?format=csv">Download spreadsheet (CSV)</a>
        </Button>
      </Container>

      {error && (
        <Container className="px-6 py-4">
          <Text className="text-ui-fg-error">{error}</Text>
        </Container>
      )}

      {data && (
        <>
          <Container className="flex flex-wrap gap-8 px-6 py-4">
            <div>
              <Text size="small" className="text-ui-fg-subtle">Interviews</Text>
              <Heading level="h2">{data.count}</Heading>
            </div>
            <div>
              <Text size="small" className="text-ui-fg-subtle">Want early access</Text>
              <Heading level="h2">{data.early_access}</Heading>
            </div>
          </Container>

          {headline.length > 0 && (
            <Container className="grid gap-6 px-6 py-4 md:grid-cols-2">
              {headline.map((s) => (
                <div key={s.id} className="flex flex-col gap-2">
                  <Text weight="plus">{s.question}</Text>
                  <Text size="xsmall" className="text-ui-fg-subtle">{s.answered} answered</Text>
                  {s.choices.slice(0, 8).map((c) => (
                    <div key={c.choice} className="grid grid-cols-[minmax(80px,35%)_1fr] items-center gap-3">
                      {/* Share of people who answered this question and picked this choice. */}
                      <div className="h-2 rounded bg-ui-bg-component">
                        <div className="h-2 rounded bg-ui-fg-interactive" style={{ width: `${Math.max(3, Math.round((c.count / Math.max(1, s.answered)) * 100))}%` }} />
                      </div>
                      <Text size="small">{c.choice} · {c.count} ({Math.round((c.count / Math.max(1, s.answered)) * 100)}%)</Text>
                    </div>
                  ))}
                </div>
              ))}
            </Container>
          )}

          <Container className="px-0 py-0">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Date</Table.HeaderCell>
                  <Table.HeaderCell>Seller</Table.HeaderCell>
                  <Table.HeaderCell>Country</Table.HeaderCell>
                  <Table.HeaderCell>Biggest problem</Table.HeaderCell>
                  <Table.HeaderCell>From</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.interviews.map((i) => {
                  const top = i.answers.find((a) => a.id === "one_problem")
                  return (
                    <Fragment key={i.id}>
                      <Table.Row>
                        <Table.Cell>{new Date(i.created_at).toLocaleDateString()}</Table.Cell>
                        <Table.Cell>
                          {i.name || "Anonymous"}
                          {i.wants_early_access && <Badge size="2xsmall" color="green" className="ml-2">early access</Badge>}
                        </Table.Cell>
                        <Table.Cell>{i.country ?? "–"}</Table.Cell>
                        <Table.Cell className="max-w-[360px] truncate">{top ? show(top.answer) : "–"}</Table.Cell>
                        <Table.Cell>{i.source ?? "–"}</Table.Cell>
                        <Table.Cell>
                          <Button variant="transparent" size="small" onClick={() => setOpen(open === i.id ? null : i.id)}>
                            {open === i.id ? "Hide" : "Read"}
                          </Button>
                        </Table.Cell>
                      </Table.Row>
                      {open === i.id && (
                        <Table.Row>
                          <td colSpan={6} className="px-6">
                            <div className="flex flex-col gap-3 py-3">
                              {(i.email || i.phone) && (
                                <Text size="small">
                                  Contact: {[i.phone, i.email].filter(Boolean).join(" · ")} {i.contact_ok ? "(OK to contact)" : ""}
                                </Text>
                              )}
                              {i.answers.map((a) => (
                                <div key={a.id}>
                                  <Text size="xsmall" className="text-ui-fg-subtle">{a.section} · {a.question}</Text>
                                  <Text size="small" className="whitespace-pre-wrap">{show(a.answer) || "–"}</Text>
                                </div>
                              ))}
                            </div>
                          </td>
                        </Table.Row>
                      )}
                    </Fragment>
                  )
                })}
                {data.interviews.length === 0 && (
                  <Table.Row>
                    <td colSpan={6} className="px-6 py-4">No interviews yet. Share app.aquenora.com/interview with sellers.</td>
                  </Table.Row>
                )}
              </Table.Body>
            </Table>
          </Container>
        </>
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Seller interviews",
  icon: ChatBubbleLeftRight,
})

export default SellerInterviewsPage
