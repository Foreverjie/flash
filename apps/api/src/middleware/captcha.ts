/**
 * Captcha verification middleware for abuse-prone endpoints (e.g. signup).
 * Verifies the hCaptcha token the client sends in the `x-token` header
 * (format: `hc:<response>`) against hCaptcha's siteverify API.
 *
 * When HCAPTCHA_SECRET is not set (local dev, CI), verification is skipped —
 * same convention as the Resend email fallback.
 */
import type { Context, Next } from "hono"

import { logger } from "../utils/logger.js"
import { sendForbidden } from "../utils/response.js"

const SITEVERIFY_URL = "https://api.hcaptcha.com/siteverify"

export async function requireCaptcha(c: Context, next: Next) {
  const secret = process.env.HCAPTCHA_SECRET
  if (!secret) {
    return next()
  }

  const header = c.req.header("x-token")
  const token = header?.startsWith("hc:") ? header.slice(3) : undefined
  if (!token) {
    return sendForbidden(c, "Captcha token required")
  }

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    })
    const result = (await response.json()) as { success: boolean; "error-codes"?: string[] }

    if (!result.success) {
      logger.warn("Captcha verification failed", { errorCodes: result["error-codes"] })
      return sendForbidden(c, "Captcha verification failed")
    }
  } catch (error) {
    logger.error("Captcha siteverify request error:", error)
    return sendForbidden(c, "Captcha verification failed")
  }

  return await next()
}
