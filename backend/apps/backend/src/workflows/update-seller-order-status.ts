import { MedusaError } from "@medusajs/framework/utils"
import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateOrdersStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"

export type SellerOrderStatus = "new" | "shipped" | "delivered"

const NEXT: Record<SellerOrderStatus, SellerOrderStatus | null> = { new: "shipped", shipped: "delivered", delivered: null }

/**
 * Moves one of the seller's orders along: paid and ready to pack -> on the way -> delivered.
 * Kept in order metadata until AQENORA uses Medusa's fulfillment flow for delivery tracking.
 */
export const updateSellerOrderStatusWorkflow = createWorkflow(
  "update-seller-order-status",
  function (input: { seller_id: string; order_id: string; status: SellerOrderStatus }) {
    const { data: sellers } = useQueryGraphStep({
      entity: "seller",
      fields: ["id", "orders.id", "orders.metadata"],
      filters: { id: input.seller_id },
      options: { throwIfKeyNotFound: true },
    })

    const update = transform({ input, sellers }, ({ input, sellers }) => {
      const orders = ((sellers[0] as unknown as { orders: ({ id: string; metadata: Record<string, unknown> | null } | null)[] }).orders ?? [])
      const order = orders.find((o) => o?.id === input.order_id)
      if (!order) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.")
      }
      const current = (order.metadata?.seller_status as SellerOrderStatus) ?? "new"
      if (NEXT[current] !== input.status) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, `This order is already marked "${current}".`)
      }
      return { selector: { id: order.id }, update: { metadata: { ...(order.metadata ?? {}), seller_status: input.status } } }
    })

    const orders = updateOrdersStep(update)
    const order = transform({ orders }, ({ orders }) => orders[0])
    return new WorkflowResponse(order)
  }
)
