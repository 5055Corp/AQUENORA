import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"
import { renderPasswordResetEmail, resetPasswordLink } from "../lib/account-email"

/** Emails a password-reset link (one AQUENORA login is shared by shopping and selling). */
export const sendPasswordResetWorkflow = createWorkflow(
  "send-password-reset",
  function (input: { email: string; token: string }) {
    const notifications = transform({ input }, ({ input }) => [
      {
        to: input.email,
        channel: "email",
        template: "aquenora-password-reset",
        data: renderPasswordResetEmail(resetPasswordLink(input.email, input.token)),
      },
    ])
    sendNotificationsStep(notifications)
    return new WorkflowResponse(true)
  }
)
