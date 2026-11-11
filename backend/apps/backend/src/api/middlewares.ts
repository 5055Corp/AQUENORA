import {
  authenticate,
  configureStoreSearch,
  defineMiddlewares,
  validateAndTransformBody,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http"
import { parseCorsOrigins } from "@medusajs/framework/utils"
import cors from "cors"
import {
  CreateSellerProductSchema,
  CreateSellerSchema,
  BillingSettingsSchema,
  SubmitInterviewSchema,
  AutoRenewSchema,
  ProCheckoutSchema,
  ProConfirmSchema,
  UploadImageSchema,
  CheckoutSchema,
  SetPayoutSchema,
  VerifyPaymentSchema,
  MarkPaidSchema,
  PlanPricesSchema,
  SendCampaignSchema,
  SetDomainSchema,
  UpdateSellerOrderSchema,
  UpdateSellerProductSchema,
  UpdateSellerSchema,
} from "./sellers/validators"

// Medusa only applies CORS to /store, /admin and /auth, so the seller app's
// origins (SELLER_CORS) are allowed on /sellers here.
const sellerCors = (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) =>
  cors({
    origin: parseCorsOrigins(process.env.SELLER_CORS ?? ""),
    credentials: true,
  })(req, res, next)

const sellerAuth = authenticate("seller", ["bearer", "session"])

export default defineMiddlewares({
  routes: [
    // The product index declares filterable `status` and `sales_channel_ids`, so
    // the route narrows it to published products in the key's sales channels.
    {
      methods: ["POST"],
      matcher: "/store/search",
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    {
      matcher: "/sellers*",
      middlewares: [sellerCors],
    },
    {
      // A new login has no store yet, so it isn't a registered seller.
      methods: ["POST"],
      matcher: "/sellers",
      middlewares: [
        authenticate("seller", ["bearer"], { allowUnregistered: true }),
        validateAndTransformBody(CreateSellerSchema),
      ],
    },
    {
      methods: ["GET"],
      matcher: "/sellers/me*",
      middlewares: [sellerAuth],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me",
      middlewares: [sellerAuth, validateAndTransformBody(UpdateSellerSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/products",
      middlewares: [sellerAuth, validateAndTransformBody(CreateSellerProductSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/products/:id",
      middlewares: [sellerAuth, validateAndTransformBody(UpdateSellerProductSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/orders/:id",
      middlewares: [sellerAuth, validateAndTransformBody(UpdateSellerOrderSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/campaigns",
      middlewares: [sellerAuth, validateAndTransformBody(SendCampaignSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/plan/*",
      middlewares: [sellerAuth],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/plan/upgrade",
      middlewares: [validateAndTransformBody(ProCheckoutSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/plan/confirm",
      middlewares: [validateAndTransformBody(ProConfirmSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/plan/auto-renew",
      middlewares: [validateAndTransformBody(AutoRenewSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/domain",
      middlewares: [sellerAuth, validateAndTransformBody(SetDomainSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/domain/verify",
      middlewares: [sellerAuth],
    },
    {
      methods: ["DELETE"],
      matcher: "/sellers/me/domain",
      middlewares: [sellerAuth],
    },
    {
      // Store logo / banner photo, sent as base64 JSON (resized by the app first).
      methods: ["POST"],
      matcher: "/sellers/me/uploads",
      bodyParser: { sizeLimit: "3mb" },
      middlewares: [sellerAuth, validateAndTransformBody(UploadImageSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/sellers/me/payouts",
      middlewares: [sellerAuth, validateAndTransformBody(SetPayoutSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/store/sellers/:handle/checkout",
      middlewares: [validateAndTransformBody(CheckoutSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/store/interviews",
      bodyParser: { sizeLimit: "200kb" },
      middlewares: [validateAndTransformBody(SubmitInterviewSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/store/payments/verify",
      middlewares: [validateAndTransformBody(VerifyPaymentSchema)],
    },
    {
      // Paystack signs the exact bytes it sends, so keep the raw body for the signature check.
      methods: ["POST"],
      matcher: "/paystack/webhook",
      bodyParser: { preserveRawBody: true },
      middlewares: [],
    },
    {
      methods: ["POST"],
      matcher: "/admin/billing/prices",
      middlewares: [validateAndTransformBody(PlanPricesSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/admin/billing/settings",
      middlewares: [validateAndTransformBody(BillingSettingsSchema)],
    },
    {
      methods: ["POST"],
      matcher: "/admin/billing/sellers/:id/paid",
      middlewares: [validateAndTransformBody(MarkPaidSchema)],
    },
  ],
})
