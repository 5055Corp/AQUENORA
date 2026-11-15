import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendPasswordResetWorkflow } from "../workflows/send-password-reset"

/** POST /auth/{customer|seller}/emailpass/reset-password -> email the reset link. */
export default async function passwordReset({ event, container }: SubscriberArgs<{ entity_id: string; token: string }>) {
  await sendPasswordResetWorkflow(container).run({ input: { email: event.data.entity_id, token: event.data.token } })
}

export const config: SubscriberConfig = { event: "auth.password_reset" }
