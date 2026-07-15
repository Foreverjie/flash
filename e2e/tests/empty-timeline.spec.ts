import { expect, test } from "@playwright/test"

import { waitForMailLink } from "../helpers/mail"

/**
 * The zero-subscription contract: a user with no subscriptions must see a
 * first-class empty state with a Discover CTA — never a blank pane.
 *
 * The signup happens in one browser context; the assertion runs in a fresh
 * context (login as the same user) so the local entry store is guaranteed
 * cold and can't mask the empty state.
 */

const PASSWORD = "e2e-Password-1234"

test("zero-feed onboarding finish lands on the Discover empty state", async ({ page, browser }) => {
  const email = `e2e-empty-${Date.now()}@flash.test`

  // — Create + verify an account, finish onboarding following nothing
  await page.goto("/")
  await page.getByRole("button", { name: "Get started" }).click()
  await page.getByRole("button", { name: "Continue with Email" }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD)
  await page.getByLabel("Confirm Password").fill(PASSWORD)
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page.getByText("We've sent a verification link")).toBeVisible({ timeout: 15_000 })

  await page.goto(await waitForMailLink(email))
  await page.waitForURL(/localhost:2233/, { timeout: 15_000 })

  // Skip topic selection, follow no feeds, finish
  await expect(page.getByText("What should the agent watch?")).toBeVisible({ timeout: 20_000 })
  await page.getByRole("button", { name: "Skip" }).click()
  await expect(page.getByText("Starter sources")).toBeVisible()
  await page.getByRole("button", { name: "Start reading" }).click()
  await page.waitForURL(/timeline/, { timeout: 20_000 })

  // — Fresh context with a cold local store. Sign in via the auth API (the
  // request shares the context's cookie jar) and land directly on /timeline.
  const context = await browser.newContext()
  const freshPage = await context.newPage()
  const loginRes = await freshPage.request.post("http://localhost:3001/api/auth/sign-in/email", {
    data: { email, password: PASSWORD },
  })
  expect(loginRes.ok()).toBeTruthy()
  await freshPage.goto("/timeline")

  // — Zero subscriptions + cold store → EmptyStage with Discover CTA
  await expect(freshPage.getByText("Follow your first feed")).toBeVisible({ timeout: 30_000 })
  const discoverCta = freshPage.getByRole("button", { name: "Discover feeds" })
  await expect(discoverCta).toBeVisible()

  // CTA leads to Discover
  await discoverCta.click()
  await freshPage.waitForURL(/discover/, { timeout: 15_000 })
  await context.close()
})
