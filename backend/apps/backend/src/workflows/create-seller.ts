import { setAuthAppMetadataStep } from "@medusajs/medusa/core-flows"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { COUNTRY_CURRENCY } from "../modules/seller/currency"
import { createSellerStep, ensureSellerHandleAvailableStep, type CreateSellerData } from "./steps/seller-steps"

export type CreateSellerWorkflowInput = {
  auth_identity_id: string
  seller: Omit<CreateSellerData, "handle" | "currency_code"> & { handle?: string }
}

/** Turns a shop name into a web address: "Adire House" -> "adirehouse". Same rule as the seller app. */
export function toHandle(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "") || "yourshop"
}

/**
 * Creates a seller's store and links it to the seller's login (auth identity),
 * so later requests with that login act as this seller.
 */
export const createSellerWorkflow = createWorkflow(
  "create-seller",
  function (input: CreateSellerWorkflowInput) {
    const data = transform({ input }, ({ input }) => {
      const country = input.seller.country_code ?? "NG"
      return {
        ...input.seller,
        handle: input.seller.handle ? toHandle(input.seller.handle) : toHandle(input.seller.name),
        country_code: country,
        currency_code: COUNTRY_CURRENCY[country],
      }
    })

    ensureSellerHandleAvailableStep({ handle: data.handle })
    const seller = createSellerStep(data)

    setAuthAppMetadataStep({
      authIdentityId: input.auth_identity_id,
      actorType: "seller",
      value: seller.id,
    })

    return new WorkflowResponse(seller)
  }
)
