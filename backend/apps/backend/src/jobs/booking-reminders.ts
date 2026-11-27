import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sendBookingReminders } from "../lib/booking-reminders"

/** Every 10 minutes: appointment reminders (the day before and 2 hours before). */
export default async function bookingRemindersJob(container: MedusaContainer) {
  const sent = await sendBookingReminders(container)
  if (sent.day || sent.hour) container.resolve(ContainerRegistrationKeys.LOGGER).info(`Booking reminders: ${sent.day} for tomorrow, ${sent.hour} in 2 hours`)
}

export const config = {
  name: "booking-reminders",
  schedule: "*/10 * * * *",
}
