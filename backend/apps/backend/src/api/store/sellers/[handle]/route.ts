import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
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

  const { products, trial_ends_at, pro_paid_until, ...store } = seller as typeof seller & { trial_ends_at?: string | null; pro_paid_until?: string | null }
  const plan = await resolvePlan(req.scope, { trial_ends_at, pro_paid_until })
  const pickup = (store as unknown as { pickup?: { enabled?: boolean } | null }).pickup
  res.json({
    store: {
      ...store,
      // Only shown to buyers when the seller has turned pickup on.
      pickup: pickup?.enabled ? pickup : null,
      show_badge: plan.show_badge,
    },
    products: newestFirst(
      (products ?? [])
        .filter(Boolean)
        .map(toSellerProduct)
        .filter((p) => p.status === "published")
    ),
  })
}
