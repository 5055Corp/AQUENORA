import type { MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BILLING_MODULE } from "../modules/billing"
import type BillingModuleService from "../modules/billing/service"
import { buyDomainUrl, dnsRecords } from "./domains"
import { planFor } from "./plans"

export const SELLER_PLAN_FIELDS = ["id", "handle", "country_code", "currency_code", "trial_ends_at", "pro_paid_until", "custom_domain", "domain_verified_at"]

type Row = {
  id: string
  handle: string
  country_code: string
  currency_code: string
  trial_ends_at: string | null
  pro_paid_until: string | null
  custom_domain: string | null
  domain_verified_at: string | null
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
    // How to pay until Paystack subscriptions are switched on (BILLING_CONTACT, e.g. a WhatsApp number).
    billing_contact: process.env.BILLING_CONTACT || null,
  }
}

export async function getSellerRow(req: MedusaRequest, sellerId: string): Promise<Row> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "seller", fields: SELLER_PLAN_FIELDS, filters: { id: sellerId } }, { throwIfKeyNotFound: true })
  return data[0] as unknown as Row
}
