import { readdirSync, readFileSync } from "node:fs"

import { join } from "pathe"

import { MAIL_OUTPUT_DIR } from "../playwright.config"

interface MailFile {
  to: string
  subject: string
  url: string
}

/**
 * Wait for the API's file mail transport (MAIL_OUTPUT_DIR, active when
 * RESEND_API_KEY is unset) to produce an email for `recipient`, and return
 * the link it contains. Newest matching file wins.
 */
export async function waitForMailLink(recipient: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    let files: string[] = []
    try {
      files = readdirSync(MAIL_OUTPUT_DIR)
    } catch {
      // Directory not created yet — no mail sent so far
    }
    const candidates = files
      .filter((f) => f.includes(recipient.toLowerCase()) && f.endsWith(".json"))
      .sort()
    const newest = candidates.at(-1)
    if (newest) {
      const mail = JSON.parse(readFileSync(join(MAIL_OUTPUT_DIR, newest), "utf8")) as MailFile
      return mail.url
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No mail for ${recipient} within ${timeoutMs}ms in ${MAIL_OUTPUT_DIR}`)
}
