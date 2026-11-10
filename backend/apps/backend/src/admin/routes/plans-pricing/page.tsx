import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CurrencyDollar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Input, Label, Table, Text, toast } from "@medusajs/ui"
import { useCallback, useEffect, useState } from "react"

type Price = { country_code: string; currency_code: string; monthly_price: number; is_default: boolean }
type Settings = { free_commission_percent: number; pro_commission_percent: number; trial_days: number }
type SellerRow = {
  id: string
  name: string
  handle: string
  country_code: string
  plan: "free" | "pro"
  plan_status: "free" | "trial" | "paid"
  trial_ends_at: string | null
  pro_paid_until: string | null
  custom_domain: string | null
}

const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  ZA: "South Africa",
  CI: "Côte d'Ivoire",
  SN: "Senegal",
  DI: "Sellers abroad (diaspora)",
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((json as { message?: string }).message || `Request failed (${res.status})`)
  }
  return json as T
}

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "")

/**
 * AQENORA owner page (/app/plans-pricing): the Pro plan's monthly price in each country, the
 * commission on each plan, the trial length, and every seller's plan (with "mark as paid" for
 * transfers).
 */
const PlansPricingPage = () => {
  const [prices, setPrices] = useState<Price[] | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Record<keyof Settings, string> | null>(null)
  const [sellers, setSellers] = useState<SellerRow[] | null>(null)
  const [saving, setSaving] = useState("")

  const load = useCallback(async () => {
    try {
      const [p, s, f] = await Promise.all([
        call<{ prices: Price[] }>("/admin/billing/prices"),
        call<{ settings: Settings }>("/admin/billing/settings"),
        call<{ sellers: SellerRow[] }>("/admin/finance/sellers?period=all"),
      ])
      setPrices(p.prices)
      setDraft(Object.fromEntries(p.prices.map((x) => [x.country_code, String(x.monthly_price)])))
      setSettings({
        free_commission_percent: String(s.settings.free_commission_percent),
        pro_commission_percent: String(s.settings.pro_commission_percent),
        trial_days: String(s.settings.trial_days),
      })
      setSellers(f.sellers)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load")
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const savePrices = async () => {
    setSaving("prices")
    try {
      const body = { prices: Object.entries(draft).map(([country_code, v]) => ({ country_code, monthly_price: Number(v) })) }
      if (body.prices.some((p) => !Number.isFinite(p.monthly_price) || p.monthly_price < 0)) {
        throw new Error("Prices must be numbers (0 or more).")
      }
      const r = await call<{ prices: Price[] }>("/admin/billing/prices", body)
      setPrices(r.prices)
      toast.success("Prices saved. Sellers see the new price straight away.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
    setSaving("")
  }

  const saveSettings = async () => {
    if (!settings) {
      return
    }
    setSaving("settings")
    try {
      await call("/admin/billing/settings", {
        free_commission_percent: Number(settings.free_commission_percent),
        pro_commission_percent: Number(settings.pro_commission_percent),
        trial_days: Number(settings.trial_days),
      })
      toast.success("Saved. New rates apply to new orders only.")
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
    setSaving("")
  }

  const markPaid = async (s: SellerRow, months: number) => {
    if (!window.confirm(`Record a payment for ${s.name}: ${months} month(s) of Pro?`)) {
      return
    }
    try {
      const r = await call<{ pro_paid_until: string }>(`/admin/billing/sellers/${s.id}/paid`, { months })
      toast.success(`${s.name} has Pro until ${date(r.pro_paid_until)}`)
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save")
    }
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-y-4 p-6">
        <div>
          <Heading level="h1">Pro plan prices by country</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            What a seller pays per month for Pro, in their own currency. Starting prices are about USD 25. Change any of them and
            press Save.
          </Text>
        </div>
        {!prices ? (
          <Text className="text-ui-fg-subtle">Loading…</Text>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {prices.map((p) => (
                <div key={p.country_code} className="flex flex-col gap-y-1">
                  <Label htmlFor={`price-${p.country_code}`} size="small" weight="plus">
                    {COUNTRY_NAMES[p.country_code] ?? p.country_code}{" "}
                    {p.is_default && <Badge size="2xsmall" className="ml-1">starting price</Badge>}
                  </Label>
                  <div className="flex items-center gap-x-2">
                    <Text size="small" className="text-ui-fg-subtle w-10">{p.currency_code.toUpperCase()}</Text>
                    <Input
                      id={`price-${p.country_code}`}
                      type="number"
                      min={0}
                      value={draft[p.country_code] ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [p.country_code]: e.target.value }))}
                    />
                    <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">/ month</Text>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <Button size="small" isLoading={saving === "prices"} onClick={savePrices}>Save prices</Button>
            </div>
          </>
        )}
      </Container>

      <Container className="flex flex-col gap-y-4 p-6">
        <div>
          <Heading level="h2">Commission and trial</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            AQENORA's share of every sale on each plan, and how long the free Pro trial lasts. Changes apply to new orders only.
          </Text>
        </div>
        {settings && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(
              [
                ["free_commission_percent", "Free plan: % per sale"],
                ["pro_commission_percent", "Pro plan: % per sale"],
                ["trial_days", "Free trial length (days)"],
              ] as [keyof Settings, string][]
            ).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-y-1">
                <Label htmlFor={key} size="small" weight="plus">{label}</Label>
                <Input id={key} type="number" min={0} step={key === "trial_days" ? 1 : 0.1} value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} />
              </div>
            ))}
          </div>
        )}
        <div>
          <Button size="small" isLoading={saving === "settings"} onClick={saveSettings}>Save</Button>
        </div>
      </Container>

      <Container className="p-0">
        <div className="p-6 pb-3">
          <Heading level="h2">Sellers' plans</Heading>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Until card payments open, record payments here (for example bank transfers). Pro is extended from today or from the
            current paid-until date, whichever is later.
          </Text>
        </div>
        {sellers && sellers.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Seller</Table.HeaderCell>
                  <Table.HeaderCell>Country</Table.HeaderCell>
                  <Table.HeaderCell>Plan</Table.HeaderCell>
                  <Table.HeaderCell>Until</Table.HeaderCell>
                  <Table.HeaderCell>Own domain</Table.HeaderCell>
                  <Table.HeaderCell className="text-right">Record payment</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sellers.map((s) => (
                  <Table.Row key={s.id}>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="txt-compact-small-plus">{s.name}</span>
                        <span className="txt-compact-xsmall text-ui-fg-subtle">{s.handle}.aqenora.com</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>{s.country_code}</Table.Cell>
                    <Table.Cell>
                      <Badge size="2xsmall" color={s.plan_status === "paid" ? "green" : s.plan_status === "trial" ? "blue" : "grey"}>
                        {s.plan_status === "paid" ? "Pro" : s.plan_status === "trial" ? "Pro trial" : "Free"}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>{s.plan_status === "paid" ? date(s.pro_paid_until) : s.plan_status === "trial" ? date(s.trial_ends_at) : "–"}</Table.Cell>
                    <Table.Cell>{s.custom_domain ?? "–"}</Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="small" variant="secondary" onClick={() => markPaid(s, 1)}>1 month</Button>
                        <Button size="small" variant="secondary" onClick={() => markPaid(s, 12)}>12 months</Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>
        )}
      </Container>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Plans & pricing",
  icon: CurrencyDollar,
})

export default PlansPricingPage
