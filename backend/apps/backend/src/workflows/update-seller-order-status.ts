import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateOrdersStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"

export type SellerOrderStatus = "new" | "shipped" | "delivered" | "ready" | "collected"

// Delivery: paid -> on the way -> delivered. Pickup: paid -> ready for pickup -> picked up.
const NEXT: Record<"delivery" | "pickup", Partial<Record<SellerOrderStatus, SellerOrderStatus>>> = {
  delivery: { new: "shipped", shipped: "delivered" },
  pickup: { new: "ready", ready: "collected" },
}

type SellerOrders = { orders: ({ id: string; metadata: Record<string, unknown> | null } | null)[] | null }
type StatusInput = { seller_id: string; order_id: string; status: SellerOrderStatus }

/** Checks the order is the seller's and that the status change is the next step. */
const prepareSellerOrderStatusStep = createStep(
  "prepare-seller-order-status",
  async ({ input, seller }: { input: StatusInput; seller: SellerOrders }) => {
    const order = (seller.orders ?? []).find((o) => o?.id === input.order_id)
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.")
    }
    const current = (order.metadata?.seller_status as SellerOrderStatus) ?? "new"
    const how = order.metadata?.fulfillment === "pickup" ? "pickup" : "delivery"
    if (NEXT[how][current] !== input.status) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `This order is already marked "${current}".`)
    }
    return new StepResponse({
      selector: { id: order.id },
      update: { metadata: { ...(order.metadata ?? {}), seller_status: input.status } },
    })
  }
)

/**
 * Moves one of the seller's orders along: paid and ready to pack -> on the way -> delivered.
 * Kept in order metadata until AQUENORA uses Medusa's fulfillment flow for delivery tracking.
 */
export const updateSellerOrderStatusWorkflow = createWorkflow(
  "update-seller-order-status",
  function (input: StatusInput) {
    const { data: sellers } = useQueryGraphStep({
      entity: "seller",
      fields: ["id", "orders.id", "orders.metadata"],
      filters: { id: input.seller_id },
      options: { throwIfKeyNotFound: true },
    })

    const update = prepareSellerOrderStatusStep({ input, seller: sellers[0] as unknown as SellerOrders })

    const orders = updateOrdersStep(update)
    const order = transform({ orders }, ({ orders }) => orders[0])
    return new WorkflowResponse(order)
  }
)
