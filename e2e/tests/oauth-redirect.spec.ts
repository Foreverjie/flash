import { expect, test } from "@playwright/test"

/**
 * OAuth coverage stops at the handoff (decision: no external IdP automation):
 * the provider buttons must render, and clicking one must redirect to the
 * correct authorize URL with our client_id and an API-origin redirect_uri.
 * Catches OAuth config drift without fighting provider bot detection.
 */

async function openLoginModal(page: import("@playwright/test").Page) {
  await page.goto("/")
  await page.getByRole("button", { name: "Login", exact: true }).first().click()
}

test("GitHub login redirects to the correct authorize URL", async ({ page }) => {
  await openLoginModal(page)

  const githubButton = page.getByRole("button", { name: /github/i })
  await expect(githubButton).toBeVisible({ timeout: 15_000 })

  const authorizeRequest = page.waitForRequest(/github\.com\/login\/oauth\/authorize/, {
    timeout: 15_000,
  })
  // Never actually reach GitHub
  await page.route("**://github.com/**", (route) => route.abort())
  await githubButton.click()

  const url = new URL((await authorizeRequest).url())
  expect(url.searchParams.get("client_id")).toBe("e2e-dummy-github")
  expect(url.searchParams.get("redirect_uri")).toContain("localhost:3001/api/auth/callback/github")
})

test("Google login redirects to the correct authorize URL", async ({ page }) => {
  await openLoginModal(page)

  const googleButton = page.getByRole("button", { name: /google/i })
  await expect(googleButton).toBeVisible({ timeout: 15_000 })

  const authorizeRequest = page.waitForRequest(/accounts\.google\.com\/o\/oauth2/, {
    timeout: 15_000,
  })
  await page.route("**://accounts.google.com/**", (route) => route.abort())
  await googleButton.click()

  const url = new URL((await authorizeRequest).url())
  expect(url.searchParams.get("client_id")).toBe("e2e-dummy-google")
  expect(url.searchParams.get("redirect_uri")).toContain("localhost:3001/api/auth/callback/google")
})
