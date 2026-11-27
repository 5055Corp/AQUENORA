// Runs once when the backend starts (Medusa calls register()). Turns on error alerts when SENTRY_DSN is set.
import { startErrorAlerts } from "./src/lib/error-alerts"

export function register() {
  startErrorAlerts()
}
