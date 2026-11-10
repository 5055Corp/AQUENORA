import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { paymentsBlocker } from "../../../../lib/checkout"
import { homeCountry, type Shipping } from "../../../../modules/seller/shipping"
import { resolvePlan } from "../../../../lib/plans"
import { newestFirst, PRODUCT_FIELDS, toSellerProduct } from "../../../sellers/fields"

/**
 * GET /store/sellers/:handle
 * Public data for a seller's storefront (adirehouse.aqenora.com): shop name, look and published products.
 * Like all /store routes, it needs an x-publishable-api-key header.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "seller",
    fields: [
      "id",
      "name",
      "handle",
      "category",
      "country_code",
      "currency_code",
      "sells_abroad",
      "theme",
      "accent",
      "font",
      "announcement",
      "design",
      "pickup",
      "paystack_subaccount_code",
      "shipping",
      "trial_ends_at",
      "pro_paid_until",
      ...PRODUCT_FIELDS,
    ],
    filters: { handle: req.params.handle },
  })

  const seller = data[0]
  if (!seller) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `No store at ${req.params.handle}.aqenora.com`)
  }

  const { products, trial_ends_at, pro_paid_until, paystack_subaccount_code, shipping, ...store } = seller as typeof seller & {
    trial_ends_at?: string | null
    pro_paid_until?: string | null
    paystack_subaccount_code?: string | null
    shipping?: Shipping | null
  }
  const plan = await resolvePlan(req.scope, { trial_ends_at, pro_paid_until })
  const pickup = (store as unknown as { pickup?: { enabled?: boolean } | null }).pickup
  res.json({
    store: {
      ...store,
      // Only shown to buyers when the seller has turned pickup on.
      pickup: pickup?.enabled ? pickup : null,
      show_badge: plan.show_badge,
      // Whether the Checkout button works (Paystack on, and the seller has connected a bank account).
      // Delivery options buyers can choose (the seller's ship-from address stays private).
      shipping: {
        ships_from: homeCountry({ country_code: store.country_code, shipping }),
        options: shipping?.options ?? [],
      },
      accepts_payments: paymentsBlocker({ country_code: store.country_code, paystack_subaccount_code }) === null,
    },
    products: newestFirst(
      (products ?? [])
        .filter(Boolean)
        .map(toSellerProduct)
        .filter((p) => p.status === "published")
    ),
  })
}
