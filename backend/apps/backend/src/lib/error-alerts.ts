// Error alerts: real server errors (5xx) go to Sentry, which emails AQUENORA.
// Set SENTRY_DSN in Railway (backend) to turn it on; without it nothing is sent.
// No personal details are sent (no emails, addresses, request bodies or cookies).

import * as Sentry from "@sentry/node"
import { errorHandler, getHttpResponseFromError, type MedusaNextFunction, type MedusaRequest, type MedusaResponse } from "@medusajs/framework/http"

let started = false

export function startErrorAlerts(): void {
  if (started || !process.env.SENTRY_DSN) return
  started = true
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        delete event.request.headers
        delete event.request.query_string
      }
      delete event.user
      return event
    },
  })
}

const medusaErrors = errorHandler()

/** Medusa's own error handler, plus an alert for errors that are AQUENORA's fault (not a buyer's typo). */
export function errorHandlerWithAlerts(err: unknown, req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  if (process.env.SENTRY_DSN && getHttpResponseFromError(err).statusCode >= 500) {
    Sentry.withScope((scope) => {
      // The route without ids: /sellers/me/products/:id rather than the real id.
      scope.setTag("route", `${req.method} ${(req.originalUrl ?? req.url).split("?")[0].replace(/\/(prod|sel|order|chk|dsp|salt|cus)_[A-Za-z0-9]+/g, "/:id")}`)
      Sentry.captureException(err)
    })
  }
  return medusaErrors(err, req, res, next)
}
