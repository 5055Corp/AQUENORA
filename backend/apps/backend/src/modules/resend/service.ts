import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type { Logger, NotificationTypes } from "@medusajs/framework/types"

type Options = { api_key: string; from: string }

/**
 * Sends email through Resend (resend.com). Each notification's data carries the finished email:
 * { subject, html, text, headers? }. Used when RESEND_API_KEY is set; otherwise emails are only
 * written to the server log.
 */
class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
  protected options_: Options
  protected logger_: Logger

  constructor({ logger }: { logger: Logger }, options: Options) {
    super()
    this.options_ = options
    this.logger_ = logger
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.api_key || !options.from) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Resend needs api_key and from (e.g. AQENORA <news@aqenora.com>).")
    }
  }

  async send(notification: NotificationTypes.ProviderSendNotificationDTO): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const data = (notification.data ?? {}) as { subject?: string; html?: string; text?: string; headers?: Record<string, string>; reply_to?: string }
    const body = JSON.stringify({
      from: notification.from || this.options_.from,
      to: [notification.to],
      subject: data.subject,
      html: data.html,
      text: data.text,
      headers: data.headers,
      reply_to: data.reply_to,
    })

    // Resend's free plan allows a few requests per second; wait and retry when told to slow down.
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${this.options_.api_key}`, "content-type": "application/json" },
        body,
      })
      if (res.status === 429 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string }
      if (!res.ok) {
        this.logger_.warn(`Resend refused an email (${res.status}): ${json.message ?? "no message"}`)
        throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Email not sent: ${json.message ?? res.status}`)
      }
      return { id: json.id }
    }
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Email not sent: Resend rate limit")
  }
}

export default ResendNotificationService
