import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { COUNTRY_CURRENCY } from "../modules/seller/currency"
import { toHandle } from "./create-seller"
import { ensureSellerHandleAvailableStep, updateSellerStep, type UpdateSellerData } from "./steps/seller-steps"

export type UpdateSellerWorkflowInput = {
  id: string
  data: UpdateSellerData
}

/** A seller's prices are in their country's currency, so the country is fixed once they have products. */
const ensureSellerCountryChangeAllowedStep = createStep(
  "ensure-seller-country-change-allowed",
  async (input: { id: string; country_code?: string }, { container }) => {
    if (!input.country_code) {
      return new StepResponse(true)
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "seller",
      fields: ["id", "country_code", "products.id"],
      filters: { id: input.id },
    })
    const seller = data[0]
    if (seller && seller.country_code !== input.country_code && (seller.products?.length ?? 0) > 0) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "You can't change your country after adding products, because their prices are in your current currency."
      )
    }
    return new StepResponse(true)
  }
)

export const updateSellerWorkflow = createWorkflow(
  "update-seller",
  function (input: UpdateSellerWorkflowInput) {
    const data = transform({ input }, ({ input }) => {
      const out: UpdateSellerData & { currency_code?: string } = { ...input.data }
      if (out.handle) {
        out.handle = toHandle(out.handle)
      }
      if (out.country_code) {
        out.currency_code = COUNTRY_CURRENCY[out.country_code]
      }
      return out
    })

    ensureSellerCountryChangeAllowedStep({ id: input.id, country_code: input.data.country_code })
    ensureSellerHandleAvailableStep({ handle: data.handle, seller_id: input.id })
    const seller = updateSellerStep({ id: input.id, data })

    return new WorkflowResponse(seller)
  }
)
