// Bookings: every change goes through a workflow (see lib/booking-flow.ts for what each one does).
import { randomBytes } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import {
  confirmBookingPayment, customerAction, sellerAction, startBooking,
  type CustomerAction, type SellerAction, type StartBookingInput,
} from "../lib/booking-flow"
import { bookingSettingsOf, sellerView, serviceView, type BookingRow, type ServiceRow } from "../lib/bookings"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

// ---------------- services (what can be booked) ----------------

export type ServiceInput = {
  name: string
  description?: string | null
  duration_min: number
  price: number
  payment: "deposit" | "full" | "none"
  deposit_type?: "fixed" | "percent"
  deposit_value?: number
  active?: boolean
  sort?: number
}

const saveBookingServiceStep = createStep("save-booking-service", async (input: { seller_id: string; id?: string; data: Partial<ServiceInput> }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  if (input.id) {
    const [before] = (await sellers.listBookingServices({ id: input.id, seller_id: input.seller_id }, { take: 1 })) as unknown as ServiceRow[]
    if (!before) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Service not found.")
    const after = (await sellers.updateBookingServices({ id: input.id, ...input.data } as never)) as unknown as ServiceRow
    return new StepResponse(serviceView(after), { id: input.id, before })
  }
  const count = (await sellers.listBookingServices({ seller_id: input.seller_id }, { take: 101, select: ["id"] })).length
  if (count >= 100) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "You can have up to 100 services.")
  const made = (await sellers.createBookingServices({ seller_id: input.seller_id, sort: count, ...input.data } as never)) as unknown as ServiceRow
  return new StepResponse(serviceView(made), { id: made.id, before: null as ServiceRow | null })
}, async (undo, { container }) => {
  if (!undo) return
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  if (undo.before) await sellers.updateBookingServices(undo.before as never)
  else await sellers.deleteBookingServices(undo.id)
})

export const saveBookingServiceWorkflow = createWorkflow("save-booking-service", function (input: { seller_id: string; id?: string; data: Partial<ServiceInput> }) {
  return new WorkflowResponse(saveBookingServiceStep(input))
})

const deleteBookingServiceStep = createStep("delete-booking-service", async (input: { seller_id: string; id: string }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const [svc] = await sellers.listBookingServices({ id: input.id, seller_id: input.seller_id }, { take: 1 })
  if (!svc) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Service not found.")
  // Soft delete: past and upcoming bookings keep the service's name.
  await sellers.softDeleteBookingServices(input.id)
  return new StepResponse(true, input.id)
}, async (id, { container }) => {
  if (id) await container.resolve<SellerModuleService>(SELLER_MODULE).restoreBookingServices(id)
})

export const deleteBookingServiceWorkflow = createWorkflow("delete-booking-service", function (input: { seller_id: string; id: string }) {
  return new WorkflowResponse(deleteBookingServiceStep(input))
})

// ---------------- the customer ----------------

const startBookingStep = createStep("start-booking", async (input: { handle: string; data: StartBookingInput }, { container }) => {
  return new StepResponse(await startBooking(container, input.handle, input.data))
})
export const startBookingWorkflow = createWorkflow("start-booking", function (input: { handle: string; data: StartBookingInput }) {
  return new WorkflowResponse(startBookingStep(input))
})

const confirmBookingPaymentStep = createStep("confirm-booking-payment", async (input: { reference: string }, { container }) => {
  return new StepResponse(await confirmBookingPayment(container, input.reference))
})
export const confirmBookingPaymentWorkflow = createWorkflow("confirm-booking-payment", function (input: { reference: string }) {
  return new WorkflowResponse(confirmBookingPaymentStep(input))
})

const customerBookingActionStep = createStep("customer-booking-action", async (input: { booking_id: string; data: CustomerAction }, { container }) => {
  return new StepResponse(await customerAction(container, input.booking_id, input.data))
})
export const customerBookingActionWorkflow = createWorkflow("customer-booking-action", function (input: { booking_id: string; data: CustomerAction }) {
  return new WorkflowResponse(customerBookingActionStep(input))
})

// ---------------- the provider ----------------

const sellerBookingActionStep = createStep("seller-booking-action", async (input: { seller_id: string; booking_id: string; data: SellerAction }, { container }) => {
  return new StepResponse(sellerView(await sellerAction(container, input.seller_id, input.booking_id, input.data)))
})
export const sellerBookingActionWorkflow = createWorkflow("seller-booking-action", function (input: { seller_id: string; booking_id: string; data: SellerAction }) {
  return new WorkflowResponse(sellerBookingActionStep(input))
})

/** The provider's private calendar feed address (made once; "new link" makes a new one). */
const bookingCalendarKeyStep = createStep("booking-calendar-key", async (input: { seller_id: string; renew?: boolean }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const seller = await sellers.retrieveSeller(input.seller_id)
  const settings = bookingSettingsOf(seller as never)
  if (settings.calendar_key && !input.renew) return new StepResponse(settings.calendar_key)
  const key = `${seller.id.slice(-8)}${randomBytes(18).toString("hex")}`
  await sellers.updateSellers({ id: seller.id, booking_settings: { ...((seller as { booking_settings?: object }).booking_settings ?? {}), calendar_key: key } } as never)
  return new StepResponse(key)
})
export const bookingCalendarKeyWorkflow = createWorkflow("booking-calendar-key", function (input: { seller_id: string; renew?: boolean }) {
  return new WorkflowResponse(bookingCalendarKeyStep(input))
})

/** Reminders: marks a booking as reminded (the job sends the email). */
const markBookingRemindedStep = createStep("mark-booking-reminded", async (input: { ids: string[]; kind: "day" | "hour" }, { container }) => {
  const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
  const at = new Date()
  if (input.ids.length) await sellers.updateBookings(input.ids.map((id) => ({ id, [input.kind === "day" ? "reminded_day_at" : "reminded_hour_at"]: at })) as never)
  return new StepResponse(input.ids.length)
})
export const markBookingsRemindedWorkflow = createWorkflow("mark-bookings-reminded", function (input: { ids: string[]; kind: "day" | "hour" }) {
  return new WorkflowResponse(markBookingRemindedStep(input))
})

export type { BookingRow }
