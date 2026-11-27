import { MedusaError } from "@medusajs/framework/utils"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"

export const nextRun = (from: Date, every: "week" | "month") => {
  const d = new Date(from)
  if (every === "week") d.setUTCDate(d.getUTCDate() + 7)
  else d.setUTCMonth(d.getUTCMonth() + 1)
  return d
}

type Input =
  | { op: "create"; seller_id: string; data: { subject: string; message: string; audience: "all" | "repeat" | "lapsed"; every: "week" | "month"; first_send_at: string } }
  | { op: "update"; seller_id: string; id: string; active: boolean }
  | { op: "delete"; seller_id: string; id: string }
  | { op: "ran"; id: string; error: string | null }

type Undo = { undo: "delete" | "restore" | "active"; id: string; active?: boolean } | null

/** Creates, pauses or removes a repeating blast; "ran" records a send and sets the next one. */
const saveCampaignScheduleStep = createStep("save-campaign-schedule", async (input: Input, { container }) => {
  const m: MarketingModuleService = container.resolve(MARKETING_MODULE)
  if (input.op === "create") {
    if ((await m.listMarketingSchedules({ seller_id: input.seller_id }, { take: 11, select: ["id"] })).length >= 10) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "You can have up to 10 repeating emails.")
    }
    const first = new Date(input.data.first_send_at)
    const { first_send_at: _f, ...rest } = input.data
    void _f
    const made = await m.createMarketingSchedules({ seller_id: input.seller_id, ...rest, next_run_at: first.getTime() < Date.now() ? new Date() : first })
    return new StepResponse(made, { undo: "delete", id: made.id } as Undo)
  }
  if (input.op === "ran") {
    const s = await m.retrieveMarketingSchedule(input.id)
    let next = nextRun(new Date(s.next_run_at), s.every)
    while (next.getTime() <= Date.now()) next = nextRun(next, s.every)
    const updated = await m.updateMarketingSchedules({ id: s.id, next_run_at: next, last_error: input.error, ...(input.error ? {} : { last_sent_at: new Date() }) })
    return new StepResponse(updated, null as Undo)
  }
  const [s] = await m.listMarketingSchedules({ id: input.id, seller_id: input.seller_id }, { take: 1 })
  if (!s) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Not found.")
  if (input.op === "delete") {
    await m.softDeleteMarketingSchedules(s.id)
    return new StepResponse(s, { undo: "restore", id: s.id } as Undo)
  }
  // Turning it back on doesn't send the missed ones: it waits for the next date.
  let next = new Date(s.next_run_at)
  while (input.active && next.getTime() <= Date.now()) next = nextRun(next, s.every)
  const updated = await m.updateMarketingSchedules({ id: s.id, active: input.active, next_run_at: next })
  return new StepResponse(updated, { undo: "active", id: s.id, active: s.active } as Undo)
}, async (undo, { container }) => {
  if (!undo) return
  const m: MarketingModuleService = container.resolve(MARKETING_MODULE)
  if (undo.undo === "delete") await m.deleteMarketingSchedules(undo.id)
  else if (undo.undo === "restore") await m.restoreMarketingSchedules(undo.id)
  else await m.updateMarketingSchedules({ id: undo.id, active: !!undo.active })
})

export const saveCampaignScheduleWorkflow = createWorkflow("save-campaign-schedule", function (input: Input) {
  return new WorkflowResponse(saveCampaignScheduleStep(input))
})
