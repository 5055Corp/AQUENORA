import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep, useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { publicApiUrl, renderCampaignEmail, shopUrl } from "../lib/campaign-email"
import type { Audience } from "../lib/customers"
import { createCampaignStep, prepareCampaignRecipientsStep, recordCampaignResultStep } from "./steps/marketing-steps"

export type SendCampaignInput = {
  seller_id: string
  subject: string
  message: string
  audience: Audience
}

/**
 * Emails a seller's past buyers who agreed to hear from the shop. Each email is personal
 * ({name}), links to the shop, and carries the buyer's own unsubscribe link.
 */
export const sendCampaignWorkflow = createWorkflow("send-campaign", function (input: SendCampaignInput) {
  const { data: sellers } = useQueryGraphStep({
    entity: "seller",
    fields: [
      "id",
      "name",
      "handle",
      "trial_ends_at",
      "pro_paid_until",
      "orders.status",
      "orders.email",
      "orders.created_at",
      "orders.shipping_address.first_name",
      "orders.shipping_address.last_name",
      "orders.items.quantity",
      "orders.items.unit_price",
    ],
    filters: { id: input.seller_id },
    options: { throwIfKeyNotFound: true },
  })

  const seller = transform({ sellers }, ({ sellers }) => sellers[0] as unknown as { id: string; name: string; handle: string; trial_ends_at?: string | null; pro_paid_until?: string | null; orders?: unknown[] | null })
  const orders = transform({ seller }, ({ seller }) => (seller.orders ?? []).filter(Boolean))

  const { recipients } = prepareCampaignRecipientsStep({ seller_id: input.seller_id, audience: input.audience, orders, seller })

  const campaignInput = transform({ input, recipients }, ({ input, recipients }) => ({
    seller_id: input.seller_id,
    subject: input.subject,
    message: input.message,
    audience: input.audience,
    recipient_count: recipients.length,
  }))
  const campaign = createCampaignStep(campaignInput)

  const notifications = transform({ input, recipients, seller, campaign }, ({ input, recipients, seller, campaign }) =>
    recipients.map((r) => ({
      to: r.email,
      channel: "email",
      template: "aquenora-campaign",
      resource_id: campaign.id,
      resource_type: "marketing_campaign",
      idempotency_key: `${campaign.id}:${r.email}`,
      data: renderCampaignEmail({
        shopName: seller.name,
        subject: input.subject,
        message: input.message,
        recipientName: r.name,
        storeUrl: shopUrl(seller.handle),
        unsubscribeUrl: `${publicApiUrl()}/marketing/unsubscribe/${r.unsubscribe_token}`,
      }),
    }))
  )
  const results = sendNotificationsStep(notifications)

  const updated = recordCampaignResultStep({ campaign_id: campaign.id, results })
  return new WorkflowResponse(updated)
})
