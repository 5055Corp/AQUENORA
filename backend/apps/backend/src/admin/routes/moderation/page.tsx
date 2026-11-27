import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ExclamationCircle } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Msg = { from: "buyer" | "seller" | "aquenora"; text: string; at: string; files?: string[] }
type Dispute = {
  id: string
  order_display_id: number
  reason_label: string
  status: string
  messages: Msg[]
  refund: { amount: number; note?: string; file?: string } | null
  decision: { outcome: string; note: string; amount?: number; due?: string } | null
  reply_by: string
  created_at: string
  buyer_email: string
  buyer_name: string | null
  seller: { id: string; name: string; handle: string; email: string; suspended_at: string | null } | null
}
type Report = {
  report_id: string
  product_id: string
  count: number
  reasons: Record<string, number>
  notes: string[]
  product: { id: string; title: string; thumbnail: string | null; hidden: boolean } | null
  seller: { id: string; name: string; handle: string; suspended_at: string | null } | null
}

const STATUS_COLOR: Record<string, "orange" | "red" | "green" | "blue" | "grey"> = { open: "orange", replied: "blue", refunded: "blue", escalated: "red", resolved: "green" }
const WHO = { buyer: "Buyer", seller: "Seller", aquenora: "AQUENORA" }

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? `Failed (${r.status})`)
}

function SuspendButton({ seller, onDone }: { seller: { id: string; suspended_at: string | null }; onDone: () => void }) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  if (seller.suspended_at) {
    return <Button size="small" variant="secondary" onClick={() => post(`/admin/sellers/${seller.id}/suspend`, { suspend: false }).then(onDone, (e) => setError(e.message))}>Restore store</Button>
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input size="small" placeholder="Reason to pause the store (emailed to seller)" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button size="small" variant="danger" onClick={() => post(`/admin/sellers/${seller.id}/suspend`, { suspend: true, reason }).then(onDone, (e) => setError(e.message))}>Suspend store</Button>
      {error && <Text size="xsmall" className="text-ui-fg-error">{error}</Text>}
    </div>
  )
}

function DisputeCard({ d, onDone }: { d: Dispute; onDone: () => void }) {
  const [text, setText] = useState("")
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")
  const act = (body: Record<string, unknown>) => post(`/admin/disputes/${d.id}`, body).then(() => { setText(""); onDone() }, (e) => setError(e.message))
  const late = d.status === "open" && new Date(d.reply_by).getTime() < Date.now()
  return (
    <Container className="flex flex-col gap-3 px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Heading level="h2">#{d.order_display_id} · {d.seller?.name ?? "?"}</Heading>
          <Text size="small" className="text-ui-fg-subtle">{d.buyer_name ?? d.buyer_email} ({d.buyer_email}) · {d.reason_label} · {new Date(d.created_at).toLocaleDateString("en-GB")}</Text>
        </div>
        <div className="flex gap-2">
          {late && <Badge color="red">Seller late to reply</Badge>}
          <Badge color={STATUS_COLOR[d.status] ?? "grey"}>{d.status}</Badge>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {d.messages.map((m, i) => (
          <div key={i} className="rounded-lg bg-ui-bg-subtle px-3 py-2">
            <Text size="small"><b>{WHO[m.from]}:</b> {m.text}</Text>
            {m.files?.map((f) => (
              <a key={f} href={`/admin/disputes/${d.id}/files/${f}`} target="_blank" rel="noreferrer">
                <img src={`/admin/disputes/${d.id}/files/${f}`} alt="Photo" className="mt-2 h-24 w-24 rounded border border-ui-border-base object-cover" />
              </a>
            ))}
          </div>
        ))}
      </div>
      {d.decision && <Text size="small"><b>Your decision:</b> {d.decision.outcome === "refund_required" ? `seller must refund ${d.decision.amount} by ${d.decision.due ? new Date(d.decision.due).toLocaleDateString("en-GB") : "?"}` : "closed in the seller's favour"}. {d.decision.note}</Text>}
      {d.status !== "resolved" && (
        <div className="flex flex-col gap-2">
          <Input placeholder="Your message or decision reason (both sides see it)" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex flex-wrap items-center gap-2">
            <Input size="small" placeholder="Refund amount" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} className="w-36" />
            <Button size="small" variant="danger" onClick={() => act({ action: "decide", outcome: "refund_required", text, amount: Number(amount) })}>Seller must refund</Button>
            <Button size="small" variant="secondary" onClick={() => act({ action: "decide", outcome: "seller", text })}>Side with seller</Button>
            <Button size="small" variant="secondary" onClick={() => act({ action: "message", text })}>Message both</Button>
            <Button size="small" variant="transparent" onClick={() => act({ action: "confirm", text: text || "Closed by AQUENORA." })}>Close</Button>
          </div>
          {error && <Text size="small" className="text-ui-fg-error">{error}</Text>}
        </div>
      )}
      {d.seller && d.status !== "resolved" && <SuspendButton seller={d.seller} onDone={onDone} />}
    </Container>
  )
}

function ReportCard({ r, onDone }: { r: Report; onDone: () => void }) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState("")
  const act = (action: "hide" | "dismiss") => post(`/admin/reports/${r.report_id}`, { action, reason }).then(onDone, (e) => setError(e.message))
  return (
    <Container className="flex flex-col gap-3 px-6 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          {r.product?.thumbnail && <img src={r.product.thumbnail} alt="" className="h-16 w-16 rounded object-cover" />}
          <div>
            <Heading level="h2">{r.product?.title ?? "Deleted product"}</Heading>
            <Text size="small" className="text-ui-fg-subtle">{r.seller?.name} · {Object.entries(r.reasons).map(([k, v]) => `${k} ×${v}`).join(", ")}</Text>
            {r.notes.slice(0, 3).map((n, i) => <Text key={i} size="small">“{n}”</Text>)}
          </div>
        </div>
        <Badge color={r.count > 2 ? "red" : "orange"}>Reported {r.count}×</Badge>
      </div>
      {r.product?.hidden ? (
        <div className="flex items-center gap-2"><Badge color="grey">Hidden</Badge><Button size="small" variant="secondary" onClick={() => post(`/admin/products/${r.product_id}/unhide`, {}).then(onDone)}>Show again</Button></div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input size="small" placeholder="Reason (emailed to seller)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button size="small" variant="danger" onClick={() => act("hide")}>Hide product</Button>
          <Button size="small" variant="secondary" onClick={() => act("dismiss")}>Dismiss</Button>
        </div>
      )}
      {r.seller && <SuspendButton seller={r.seller} onDone={onDone} />}
      {error && <Text size="small" className="text-ui-fg-error">{error}</Text>}
    </Container>
  )
}

const TABS = [["active", "Open problems"], ["escalated", "Asking for you"], ["reports", "Reported products"], ["resolved", "Closed"]] as const

/** Buyers' problems with orders, reported products, and pausing stores. */
const ModerationPage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("active")
  const [disputes, setDisputes] = useState<Dispute[] | null>(null)
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState("")
  const load = useCallback(() => {
    setError("")
    if (tab === "reports") {
      setReports(null)
      fetch("/admin/reports", { credentials: "include" }).then(async (r) => (r.ok ? setReports((await r.json()).reports) : setError(`Could not load (${r.status})`)))
    } else {
      setDisputes(null)
      fetch(`/admin/disputes?status=${tab}`, { credentials: "include" }).then(async (r) => (r.ok ? setDisputes((await r.json()).disputes) : setError(`Could not load (${r.status})`)))
    }
  }, [tab])
  useEffect(() => { load() }, [load])
  const list = tab === "reports" ? reports : disputes
  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-3 px-6 py-4">
        <div>
          <Heading>Disputes & moderation</Heading>
          <Text size="small" className="text-ui-fg-subtle">Sellers refund buyers directly; you step in when they can't agree. Hide products that break the rules, or pause a store.</Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map(([k, l]) => <Button key={k} size="small" variant={tab === k ? "primary" : "secondary"} onClick={() => setTab(k)}>{l}</Button>)}
        </div>
      </Container>
      {error && <Container className="px-6 py-4"><Text className="text-ui-fg-error">{error}</Text></Container>}
      {!list && !error && <Container className="px-6 py-4"><Text>Loading…</Text></Container>}
      {list && list.length === 0 && <Container className="px-6 py-4"><Text className="text-ui-fg-subtle">Nothing here right now.</Text></Container>}
      {tab === "reports" ? reports?.map((r) => <ReportCard key={r.product_id} r={r} onDone={load} />) : disputes?.map((d) => <DisputeCard key={d.id} d={d} onDone={load} />)}
    </div>
  )
}

export const config = defineRouteConfig({ label: "Disputes & moderation", icon: ExclamationCircle })
export default ModerationPage
