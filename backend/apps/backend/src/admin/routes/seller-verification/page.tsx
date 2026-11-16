import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShieldCheck } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Text } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Verification = {
  type?: "registered" | "individual"
  business_name?: string
  cac_number?: string
  id_type?: string
  socials?: { instagram?: string; tiktok?: string; facebook?: string }
  submitted_at?: string
  reviewed_at?: string | null
  reject_reason?: string | null
}
type Seller = {
  id: string
  name: string
  handle: string
  email: string
  country_code: string
  category: string
  verification_status: "unverified" | "pending" | "verified" | "rejected"
  verification: Verification | null
  payout: { bank_name?: string; account_name?: string | null; account_last4?: string } | null
}
type Doc = { id: string; kind: "cac" | "id" | "selfie"; mime_type: string }

const TABS = [["pending", "Waiting"], ["rejected", "Rejected"], ["verified", "Verified"], ["all", "All"]] as const
const ID_NAMES: Record<string, string> = { nin: "NIN / National ID slip", drivers_licence: "Driver's licence", passport: "International passport", voters_card: "Voter's card", national_id: "National ID card" }
const DOC_NAMES: Record<Doc["kind"], string> = { cac: "CAC certificate", id: "Government ID", selfie: "Selfie" }
const SOCIAL_URL = { instagram: "https://instagram.com/", tiktok: "https://www.tiktok.com/@", facebook: "https://facebook.com/" } as const
const COLOR = { pending: "orange", rejected: "red", verified: "green", unverified: "grey" } as const

/** Check new sellers before they can take payments (anti-scam). */
const SellerVerificationPage = () => {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("pending")
  const [sellers, setSellers] = useState<Seller[] | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(() => {
    setSellers(null)
    fetch(`/admin/verifications?status=${tab}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load (${res.status})`)
        setSellers((await res.json()).sellers)
      })
      .catch((e: Error) => setError(e.message))
  }, [tab])
  useEffect(load, [load])

  return (
    <div className="flex flex-col gap-y-4">
      <Container className="flex flex-col gap-3 px-6 py-4">
        <div>
          <Heading>Seller verification</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            New sellers can't take payments until you approve them here. Check the documents, open their social pages, and make sure the bank account name matches.
          </Text>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map(([key, label]) => (
            <Button key={key} size="small" variant={tab === key ? "primary" : "secondary"} onClick={() => setTab(key)}>{label}</Button>
          ))}
        </div>
      </Container>

      {error && <Container className="px-6 py-4"><Text className="text-ui-fg-error">{error}</Text></Container>}
      {!sellers && !error && <Container className="px-6 py-4"><Text>Loading…</Text></Container>}
      {sellers && sellers.length === 0 && <Container className="px-6 py-4"><Text className="text-ui-fg-subtle">Nobody here right now.</Text></Container>}
      {sellers?.map((s) => <SellerCard key={s.id} seller={s} onDone={load} />)}
    </div>
  )
}

function SellerCard({ seller: s, onDone }: { seller: Seller; onDone: () => void }) {
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const v = s.verification ?? {}

  useEffect(() => {
    fetch(`/admin/verifications/${s.id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setDocs(j.documents ?? []))
      .catch(() => setDocs([]))
  }, [s.id])

  const decide = async (decision: "approve" | "reject") => {
    if (decision === "reject" && !reason.trim()) return setError("Write a reason first, so the seller knows what to fix.")
    setBusy(true)
    setError("")
    const res = await fetch(`/admin/verifications/${s.id}`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(decision === "approve" ? { decision } : { decision, reason: reason.trim() }),
    })
    setBusy(false)
    if (!res.ok) return setError(`Could not save (${res.status})`)
    onDone()
  }

  const socials = (Object.keys(SOCIAL_URL) as (keyof typeof SOCIAL_URL)[]).filter((k) => v.socials?.[k])

  return (
    <Container className="flex flex-col gap-4 px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading level="h2">{s.name}</Heading>
          <Text size="small" className="text-ui-fg-subtle">{s.handle}.aquenora.com · {s.email} · {s.country_code} · {s.category}</Text>
        </div>
        <Badge color={COLOR[s.verification_status]}>{s.verification_status}</Badge>
      </div>

      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
        <Text size="small"><b>Type:</b> {v.type === "registered" ? "Registered business" : v.type === "individual" ? "Not registered (ID + selfie)" : "—"}</Text>
        {v.type === "registered" && <Text size="small"><b>Business name:</b> {v.business_name} · <b>CAC:</b> {v.cac_number}</Text>}
        {v.type === "individual" && <Text size="small"><b>ID type:</b> {ID_NAMES[v.id_type ?? ""] ?? v.id_type}</Text>}
        <Text size="small">
          <b>Bank:</b> {s.payout ? `${s.payout.bank_name ?? ""} ••••${s.payout.account_last4 ?? ""}${s.payout.account_name ? ` · name: ${s.payout.account_name}` : ""}` : "not connected yet"}
        </Text>
        {v.submitted_at && <Text size="small"><b>Sent:</b> {new Date(v.submitted_at).toLocaleString("en-GB")}</Text>}
        {v.reject_reason && <Text size="small" className="text-ui-fg-error"><b>Last rejected:</b> {v.reject_reason}</Text>}
      </div>

      {socials.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {socials.map((k) => (
            <a key={k} className="text-ui-fg-interactive txt-compact-small" href={`${SOCIAL_URL[k]}${v.socials?.[k]}`} target="_blank" rel="noreferrer">
              {k}: @{v.socials?.[k]} ↗
            </a>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        {docs === null && <Text size="small">Loading documents…</Text>}
        {docs?.length === 0 && <Text size="small" className="text-ui-fg-subtle">No documents.</Text>}
        {docs?.map((d) => {
          const url = `/admin/verifications/${s.id}/documents/${d.id}`
          return (
            <a key={d.id} href={url} target="_blank" rel="noreferrer" className="flex flex-col gap-1">
              {d.mime_type === "application/pdf" ? (
                <span className="flex h-32 w-32 items-center justify-center rounded-lg border border-ui-border-base txt-compact-small">PDF ↗</span>
              ) : (
                <img src={url} alt={DOC_NAMES[d.kind]} className="h-32 w-32 rounded-lg border border-ui-border-base object-cover" />
              )}
              <Text size="xsmall">{DOC_NAMES[d.kind]}</Text>
            </a>
          )
        })}
      </div>

      {s.verification_status === "pending" && (
        <div className="flex flex-col gap-2">
          <Input placeholder="Reason, if you reject (the seller sees this)" value={reason} onChange={(e) => setReason(e.target.value)} />
          {error && <Text size="small" className="text-ui-fg-error">{error}</Text>}
          <div className="flex gap-2">
            <Button size="small" disabled={busy} onClick={() => decide("approve")}>Approve</Button>
            <Button size="small" variant="danger" disabled={busy} onClick={() => decide("reject")}>Reject</Button>
          </div>
        </div>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Seller verification",
  icon: ShieldCheck,
})

export default SellerVerificationPage
