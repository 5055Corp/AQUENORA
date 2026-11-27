import { MedusaService } from "@medusajs/framework/utils"
import BillingSettings from "./models/billing-settings"
import PlanPrice from "./models/plan-price"
import ProPayment from "./models/pro-payment"
import EmailPurchase from "./models/email-purchase"

export type Settings = {
  free_commission_percent: number
  pro_commission_percent: number
  trial_days: number
  booking_fee_percent: number
  free_emails_per_month: number
  extra_email_price_ngn: number
}

export const DEFAULT_SETTINGS: Settings = {
  free_commission_percent: 3,
  pro_commission_percent: 1,
  trial_days: 14,
  booking_fee_percent: 3,
  free_emails_per_month: 100,
  extra_email_price_ngn: 20,
}

/**
 * Starting Pro prices: about USD 25 a month, rounded to friendly local amounts (Nov 2026 rates).
 * The AQUENORA team changes them in the admin dashboard ("Plans & pricing").
 */
export const DEFAULT_PRICES: Record<string, { currency_code: string; monthly_price: number }> = {
  NG: { currency_code: "ngn", monthly_price: 38500 },
  GH: { currency_code: "ghs", monthly_price: 375 },
  ZA: { currency_code: "zar", monthly_price: 450 },
  CI: { currency_code: "xof", monthly_price: 15000 },
  SN: { currency_code: "xof", monthly_price: 15000 },
  DI: { currency_code: "usd", monthly_price: 25 },
}

class BillingModuleService extends MedusaService({ PlanPrice, BillingSettings, ProPayment, EmailPurchase }) {
  async getSettings(): Promise<Settings> {
    const [row] = await this.listBillingSettings({}, { take: 1 })
    if (!row) {
      return { ...DEFAULT_SETTINGS }
    }
    return {
      free_commission_percent: Number(row.free_commission_percent),
      pro_commission_percent: Number(row.pro_commission_percent),
      trial_days: Number(row.trial_days),
      booking_fee_percent: Number(row.booking_fee_percent ?? DEFAULT_SETTINGS.booking_fee_percent),
      free_emails_per_month: Number(row.free_emails_per_month ?? DEFAULT_SETTINGS.free_emails_per_month),
      extra_email_price_ngn: Number(row.extra_email_price_ngn ?? DEFAULT_SETTINGS.extra_email_price_ngn),
    }
  }

  /** Every country's Pro price: saved ones, else the defaults. */
  async getPrices(): Promise<{ country_code: string; currency_code: string; monthly_price: number; is_default: boolean }[]> {
    const saved = new Map((await this.listPlanPrices({})).map((p) => [p.country_code, p]))
    return Object.entries(DEFAULT_PRICES).map(([country_code, d]) => {
      const s = saved.get(country_code)
      return s
        ? { country_code, currency_code: s.currency_code, monthly_price: Number(s.monthly_price), is_default: false }
        : { country_code, ...d, is_default: true }
    })
  }
}

export default BillingModuleService
