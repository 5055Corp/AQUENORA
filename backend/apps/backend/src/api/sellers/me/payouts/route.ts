import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  createSubaccount,
  listBanks,
  PAYSTACK_CURRENCY,
  resolveAccount,
  updateSubaccount,
} from "../../../../lib/paystack"
import { resolvePlan } from "../../../../lib/plans"
import { updateSellerWorkflow } from "../../../../workflows/update-seller"
import { SELLER_FIELDS } from "../../fields"
import type { SetPayoutBody } from "../../validators"

/** Paystack can check the account holder's name for these countries before saving. */
const CAN_RESOLVE = new Set(["NG", "GH"])

/**
 * POST /sellers/me/payouts: connect (or change) the bank account sales are paid into.
 * Creates the seller's Paystack subaccount, or updates it, and returns the seller.
 */
export async function POST(req: AuthenticatedMedusaRequest<SetPayoutBody>, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const id = req.auth_context.actor_id
  const { data } = await query.graph(
    {
      entity: "seller",
      fields: ["id", "name", "email", "country_code", "paystack_subaccount_code", "trial_ends_at", "pro_paid_until"],
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  )
  const seller = data[0] as unknown as {
    name: string
    email: string
    country_code: string
    paystack_subaccount_code: string | null
    trial_ends_at: string | null
    pro_paid_until: string | null
  }
  const currency = PAYSTACK_CURRENCY[seller.country_code]
  if (!currency) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Paystack doesn't support payouts in your country yet.")
  }
  const { bank_code, account_number } = req.validatedBody
  const bank = (await listBanks(currency)).find((b) => b.code === bank_code)
  if (!bank) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Choose your bank from the list.")
  }
  const accountName = CAN_RESOLVE.has(seller.country_code) ? await resolveAccount(account_number, bank_code) : null

  const plan = await resolvePlan(req.scope, seller)
  const input = {
    business_name: seller.name,
    settlement_bank: bank_code,
    account_number,
    percentage_charge: plan.commission_percent,
    primary_contact_email: seller.email,
  }
  const sub = seller.paystack_subaccount_code
    ? await updateSubaccount(seller.paystack_subaccount_code, input)
    : await createSubaccount(input)

  await updateSellerWorkflow(req.scope).run({
    input: {
      id,
      data: {
        paystack_subaccount_code: sub.subaccount_code,
        payout: {
          bank_name: bank.name,
          bank_code,
          account_last4: account_number.slice(-4),
          account_name: accountName ?? sub.account_name ?? null,
          connected_at: new Date().toISOString(),
        },
      },
    },
  })
  const { data: updated } = await query.graph({ entity: "seller", fields: SELLER_FIELDS, filters: { id } })
  res.json({ seller: updated[0] })
}
