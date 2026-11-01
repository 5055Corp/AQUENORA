import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
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
      ...PRODUCT_FIELDS,
    ],
    filters: { handle: req.params.handle },
  })

  const seller = data[0]
  if (!seller) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `No store at ${req.params.handle}.aqenora.com`)
  }

  const { products, ...store } = seller
  res.json({
    store,
    products: newestFirst(
      (products ?? [])
        .filter(Boolean)
        .map(toSellerProduct)
        .filter((p) => p.status === "published")
    ),
  })
}
