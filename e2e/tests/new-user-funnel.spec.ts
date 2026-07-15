import { expect, test } from "@playwright/test"

import { waitForMailLink } from "../helpers/mail"

/**
 * The new-user critical path, end to end:
 * signup → "check your email" → click verification link (lands signed-in)
 * → onboarding (topics → starter feeds) → subscribe → timeline shows entries
 * → reload does not re-show onboarding.
 *
 * Requires the database to be migrated and seeded with `db:seed:e2e`
 * (topics: Tech/AI/Design, feeds like "Daily Bits", posts "E2E fixture post N").
 */

const PASSWORD = "e2e-Password-1234"

test.describe.configure({ mode: "serial" })

test("signup → email verification → onboarding → subscribed timeline", async ({ page }) => {
  const email = `e2e-user-${Date.now()}@flash.test`

  // — Landing: unauthenticated visitors get the onboarding welcome stage
  await page.goto("/")
  await page.getByRole("button", { name: "Get started" }).click()

  // — Register via email
  await page.getByRole("button", { name: "Continue with Email" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()

  // — "Check your email" screen appears
  await expect(page.getByText("We've sent a verification link")).toBeVisible({ timeout: 15_000 })

  // — Fetch the real verification link from the file mail transport and click it.
  // autoSignInAfterVerification + callbackURL=web origin must land us signed-in
  // in the web app, not stranded on the API origin.
  const verifyUrl = await waitForMailLink(email)
  await page.goto(verifyUrl)
  await page.waitForURL(/localhost:2233/, { timeout: 15_000 })

  // — Onboarding shows for the fresh account. Step 1 auto-advances for
  // authenticated users; step 2 is topic selection.
  await expect(page.getByText("What should the agent watch?")).toBeVisible({ timeout: 20_000 })
  await page.getByRole("button", { name: "Tech", exact: true }).click()
  await page.getByRole("button", { name: "Continue" }).click()

  // — Step 3: feeds matched to the topic arrive pre-followed; verify and finish
  await expect(page.getByText("Starter sources")).toBeVisible()
  await expect(page.getByText("Daily Bits", { exact: true })).toBeVisible()
  await expect(page.getByText(/[1-9] following/)).toBeVisible()
  await page.getByRole("button", { name: "Start reading" }).click()

  // — Funnel end state: timeline shows entries from the subscribed feed
  // (case-insensitive: entry titles render with CSS text-transform)
  await page.waitForURL(/timeline/, { timeout: 20_000 })
  await expect(page.getByText(/E2E fixture post/i).first()).toBeVisible({ timeout: 20_000 })

  // — Onboarding must not reappear on reload (completion was persisted)
  await page.reload()
  await expect(page.getByText(/E2E fixture post/i).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText("What should the agent watch?")).not.toBeVisible()
})
