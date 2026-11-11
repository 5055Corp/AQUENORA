import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { RESEARCH_MODULE } from "../modules/research"
import type ResearchModuleService from "../modules/research/service"

export type SubmitSellerInterviewInput = {
  answers: Record<string, unknown>
  name: string | null
  email: string | null
  phone: string | null
  contact_ok: boolean
  wants_early_access: boolean
  country: string | null
  source: string | null
  version: string
}

const saveInterviewStep = createStep(
  "save-interview",
  async (input: SubmitSellerInterviewInput, { container }) => {
    const research = container.resolve<ResearchModuleService>(RESEARCH_MODULE)
    const saved = await research.createSellerInterviews(input)
    return new StepResponse({ id: saved.id }, saved.id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<ResearchModuleService>(RESEARCH_MODULE).deleteSellerInterviews(id)
    }
  }
)

/** Saves one seller's interview answers (market research). */
export const submitSellerInterviewWorkflow = createWorkflow("submit-seller-interview", function (input: SubmitSellerInterviewInput) {
  return new WorkflowResponse(saveInterviewStep(input))
})
