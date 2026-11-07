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
  ],
})
