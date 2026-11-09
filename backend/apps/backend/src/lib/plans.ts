// Which plan a seller is on and what it unlocks. The single source of truth for feature limits.
//
//   Free:  shop at <handle>.aqenora.com with a "Powered by AQENORA" badge, Financials totals only,
//          1 email campaign a week, AQENORA keeps free_commission_percent of each sale (default 3%).
//   Pro:   own domain, no badge, full Financials (charts, profit per product), 1 campaign a day,
//          pro_commission_percent of each sale (default 1%). About USD 25 a month in local currency.
//   Trial: Pro features for trial_days (default 14), but the badge stays until the seller pays.

import type { Settings } from "../modules/billing/service"

export type PlanSeller = {
  trial_ends_at?: string | Date | null
  pro_paid_until?: string | Date | null
}

export type PlanInfo = {
  plan: "free" | "pro"
  status: "free" | "trial" | "paid"
  trial_ends_at: string | null
  pro_paid_until: string | null
  /** True once a trial was started (it can only be used once). */
  trial_used: boolean
  /** "Powered by AQENORA" shows on the store unless the seller pays for Pro. */
  show_badge: boolean
  commission_percent: number
  features: {
    custom_domain: boolean
    full_financials: boolean
    /** Days a shop must wait between email campaigns. */
    campaign_interval_days: number
  }
}

const iso = (d: string | Date | null | undefined) => (d ? new Date(d).toISOString() : null)

export function planFor(seller: PlanSeller, settings: Settings, now = new Date()): PlanInfo {
  const paid = !!seller.pro_paid_until && new Date(seller.pro_paid_until) > now
  const trial = !paid && !!seller.trial_ends_at && new Date(seller.trial_ends_at) > now
  const pro = paid || trial
  return {
    plan: pro ? "pro" : "free",
    status: paid ? "paid" : trial ? "trial" : "free",
    trial_ends_at: iso(seller.trial_ends_at),
    pro_paid_until: iso(seller.pro_paid_until),
    trial_used: !!seller.trial_ends_at,
    show_badge: !paid,
    commission_percent: pro ? settings.pro_commission_percent : settings.free_commission_percent,
    features: {
      custom_domain: pro,
      full_financials: pro,
      campaign_interval_days: pro ? 1 : 7,
    },
  }
}

export const PLAN_FIELDS = ["trial_ends_at", "pro_paid_until"]
