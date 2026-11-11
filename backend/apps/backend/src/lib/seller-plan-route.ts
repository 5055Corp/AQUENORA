import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"
import { buyDomainUrl, dnsRecords } from "./domains"
import { planFor } from "./plans"
import { paystackEnabled } from "./paystack"
import { billingSummary, monthlyCharge, type ProBilling } from "./pro-billing"

export const SELLER_PLAN_FIELDS = ["id", "handle", "country_code", "currency_code", "trial_ends_at", "pro_paid_until", "pro_billing", "custom_domain", "domain_verified_at"]

type Row = {
  id: string
  handle: string
  country_code: string
  currency_code: string
  trial_ends_at: string | null
  pro_paid_until: string | null
  custom_domain: string | null
  domain_verified_at: string | null
  pro_billing: ProBilling | null
}

/** Everything the seller app's "Plan & domain" page shows. */
export async function sellerPlanResponse(req: MedusaRequest, sellerId: string) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: SELLER_PLAN_FIELDS, filters: { id: sellerId } }, { throwIfKeyNotFound: true })
  const seller = data[0] as unknown as Row
  const billing: BillingModuleService = req.scope.resolve(BILLING_MODULE)
  const settings = await billing.getSettings()
  const price = (await billing.getPrices()).find((p) => p.country_code === seller.country_code)
  return {
    plan: planFor(seller, settings),
    price: price ? { currency_code: price.currency_code, monthly_price: price.monthly_price } : null,
    settings,
    domain: seller.custom_domain
      ? { name: seller.custom_domain, connected: !!seller.domain_verified_at, records: dnsRecords(seller.custom_domain) }
      : null,
    buy_domain_url: buyDomainUrl(seller.handle),
    // Pro is paid by card through Paystack and renews monthly.
    billing: {
      card_payments: paystackEnabled(),
      // What the card is charged each month (may be converted to AQUENORA's Paystack currency).
      charge: await monthlyCharge(req.scope, seller.country_code)
        .then((c) => ({ amount: c.amount, currency_code: c.currency.toLowerCase() }))
        .catch(() => null),
      ...billingSummary(seller),
    },
  }
}

export async function getSellerRow(req: MedusaRequest, sellerId: string): Promise<Row> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: SELLER_PLAN_FIELDS, filters: { id: sellerId } }, { throwIfKeyNotFound: true })
  return data[0] as unknown as Row
}
