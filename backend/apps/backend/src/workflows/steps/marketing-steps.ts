import { randomBytes } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { audienceCounts, inAudience, pastCustomers, type Audience } from "../../lib/customers"
import { MARKETING_MODULE } from "../../modules/marketing"
import type MarketingModuleService from "../../modules/marketing/service"

const newToken = () => randomBytes(24).toString("base64url")

/**
 * Remembers a buyer for the shop's customer list. Only an explicit "yes" at checkout subscribes
 * them (again, if they had unsubscribed); an order without it never changes their choice.
 */
export const upsertMarketingContactStep = createStep(
  "upsert-marketing-contact",
  async (input: { seller_id: string; email: string; name?: string; opt_in?: boolean }, { container }) => {
    const marketing: MarketingModuleService = container.resolve(MARKETING_MODULE)
    const email = input.email.trim().toLowerCase()
    const [existing] = await marketing.listMarketingContacts({ seller_id: input.seller_id, email }, { take: 1 })

    if (!existing) {
      const created = await marketing.createMarketingContacts({
        seller_id: input.seller_id,
        email,
        name: input.name || null,
        subscribed: !!input.opt_in,
        consented_at: input.opt_in ? new Date() : null,
        unsubscribe_token: newToken(),
      })
      return new StepResponse(created, { created: created.id })
    }

    const update: Record<string, unknown> = { id: existing.id }
    if (input.name) {
      update.name = input.name
    }
    if (input.opt_in && !existing.subscribed) {
      Object.assign(update, { subscribed: true, consented_at: new Date(), unsubscribed_at: null })
    }
    const updated = await marketing.updateMarketingContacts(update as { id: string })
    return new StepResponse(updated, {
      previous: { id: existing.id, name: existing.name, subscribed: existing.subscribed, consented_at: existing.consented_at, unsubscribed_at: existing.unsubscribed_at },
    })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const marketing: MarketingModuleService = container.resolve(MARKETING_MODULE)
    if ("created" in undo && undo.created) {
      await marketing.deleteMarketingContacts(undo.created)
    } else if ("previous" in undo && undo.previous) {
      await marketing.updateMarketingContacts(undo.previous)
    }
  }
)

export type CampaignRecipient = { email: string; name: string | null; unsubscribe_token: string }

/** Campaigns a seller may send per 24 hours (CAMPAIGNS_PER_DAY, default 1). Protects buyers and sending reputation. */
function campaignsPerDay(): number {
  const n = Number(process.env.CAMPAIGNS_PER_DAY ?? 1)
  return Number.isInteger(n) && n > 0 ? n : 1
}

/** Picks the subscribed buyers in the audience and checks the daily limit. */
export const prepareCampaignRecipientsStep = createStep(
  "prepare-campaign-recipients",
  async (input: { seller_id: string; audience: Audience; orders: unknown[] }, { container }) => {
    const marketing: MarketingModuleService = container.resolve(MARKETING_MODULE)

    const since = new Date(Date.now() - 86400000)
    const recent = await marketing.listMarketingCampaigns({ seller_id: input.seller_id, sent_at: { $gte: since } })
    if (recent.length >= campaignsPerDay()) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "You've already sent a campaign in the last 24 hours. Sending less often keeps customers happy, so try again tomorrow."
      )
    }

    const contacts = await marketing.listMarketingContacts({ seller_id: input.seller_id })
    const customers = inAudience(pastCustomers(input.orders, contacts), input.audience)
    if (!customers.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No customers in this group have agreed to get emails yet.")
    }
    const tokens = new Map(contacts.map((c) => [c.email, c.unsubscribe_token]))
    const recipients: CampaignRecipient[] = customers.map((c) => ({ email: c.email, name: c.name, unsubscribe_token: tokens.get(c.email)! }))
    return new StepResponse({ recipients, counts: audienceCounts(pastCustomers(input.orders, contacts)) })
  }
)

export const createCampaignStep = createStep(
  "create-marketing-campaign",
  async (input: { seller_id: string; subject: string; message: string; audience: Audience; recipient_count: number }, { container }) => {
    const marketing: MarketingModuleService = container.resolve(MARKETING_MODULE)
    const campaign = await marketing.createMarketingCampaigns({ ...input, sent_at: new Date() })
    return new StepResponse(campaign, campaign.id)
  },
  async (id, { container }) => {
    if (id) {
      const marketing: MarketingModuleService = container.resolve(MARKETING_MODULE)
      await marketing.deleteMarketingCampaigns(id)
    }
  }
)

/** Stores how many emails went out and how many failed. */
export const recordCampaignResultStep = createStep(
  "record-marketing-campaign-result",
  async (input: { campaign_id: string; results: { status?: string }[] }, { container }) => {
    const marketing: MarketingModuleService = container.resolve(MARKETING_MODULE)
    const failed = input.results.filter((r) => r.status === "failure").length
    const campaign = await marketing.updateMarketingCampaigns({
      id: input.campaign_id,
      sent_count: input.results.length - failed,
      failed_count: failed,
    })
    return new StepResponse(campaign)
  }
)
