import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const REDIS_URL = process.env.REDIS_URL

/**
 * With REDIS_URL set (production), background events, workflows and locks go through Redis so
 * they survive restarts and work across several server instances. Without it (local
 * development, tests), Medusa's in-memory versions are used.
 */
const redisModules = REDIS_URL
  ? [
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: {
          redisUrl: REDIS_URL,
          jobOptions: { attempts: 3, removeOnComplete: { age: 3600 } },
        },
      },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { redisUrl: REDIS_URL } },
      },
      {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl: REDIS_URL },
            },
          ],
        },
      },
    ]
  : []

/**
 * Email. With RESEND_API_KEY (production), emails go out through Resend from EMAIL_FROM.
 * Without it (local development, tests), emails are only written to the server log.
 * The "feed" channel is the admin dashboard's in-app notifications.
 */
const notificationModule = {
  resolve: "@medusajs/medusa/notification",
  options: {
    providers: process.env.RESEND_API_KEY
      ? [
          { resolve: "@medusajs/medusa/notification-local", id: "local", options: { channels: ["feed"] } },
          {
            resolve: "./src/modules/resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY,
              from: process.env.EMAIL_FROM || "AQENORA <news@aqenora.com>",
            },
          },
        ]
      : [{ resolve: "@medusajs/medusa/notification-local", id: "local", options: { channels: ["feed", "email"] } }],
  },
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Hosted databases that require SSL: set DATABASE_SSL=true. Railway's private network doesn't need it.
    databaseDriverOptions:
      process.env.DATABASE_SSL === "true"
        ? { connection: { ssl: { rejectUnauthorized: false } } }
        : {},
    redisUrl: REDIS_URL,
    // "shared" = one instance serves the API and runs background jobs. Split into "server" + "worker"
    // instances when traffic grows.
    workerMode: (process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server") || "shared",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      // Required in production: Medusa refuses to start without them.
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
      // Sellers sign in with email + password only.
      authMethodsPerActor: {
        user: ["emailpass"],
        customer: ["emailpass"],
        seller: ["emailpass"],
      },
    },
  },
  admin: {
    // The admin dashboard (/app) is for the AQENORA team, not sellers.
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },
  modules: [
    { resolve: "./src/modules/seller" },
    { resolve: "./src/modules/marketing" },
    { resolve: "./src/modules/billing" },
    notificationModule,
    ...redisModules,
  ],
})
