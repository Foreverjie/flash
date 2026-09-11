import { expect, test } from "@playwright/test"

test("mobile Discover keeps follow actions within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await page.route("**/trending/feeds?*", (route) =>
    route.fulfill({
      json: {
        data: [
          {
            feed: {
              id: "discover-layout-fixture",
              title: "A very long source title that must never push the follow action off screen",
              url: "https://example.com/feed.xml",
            },
            analytics: { subscriptionCount: 12, view: 0 },
          },
        ],
      },
    }),
  )
  await page.goto("/discover")
  await expect(page.getByRole("heading", { name: "Find your next obsession." })).toBeVisible()
  const follow = page.getByRole("button", { name: "Follow", exact: true }).first()
  await expect(follow).toBeVisible()
  const bounds = await follow.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320)
})

test("search can be submitted, cleared and revisited without another request", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let requests = 0
  await page.route(/\/discover\/?$/, (route) => {
    if (route.request().method() !== "POST") return route.continue()
    requests++
    return route.fulfill({ json: { data: [] } })
  })
  await page.goto("/discover")
  const input = page.getByTestId("discover-search-input")
  await input.fill("layout-fixture")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.getByText("Try another name or paste a feed URL.")).toBeVisible()
  await page.getByRole("button", { name: "Clear search" }).click()
  await expect(input).toBeFocused()
  await expect(page.getByRole("heading", { name: "Find your next obsession." })).toBeVisible()
  await input.fill("layout-fixture")
  await input.press("Enter")
  await expect(page.getByText("Try another name or paste a feed URL.")).toBeVisible()
  expect(requests).toBe(1)
})

test("failed search offers a working retry instead of claiming no results", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let fail = true
  await page.route(/\/discover\/?$/, (route) => {
    if (route.request().method() !== "POST") return route.continue()
    return route.fulfill({ status: fail ? 500 : 200, json: { data: [] } })
  })
  await page.goto("/discover?keyword=retry-fixture")
  await expect(page.getByText("Search couldn't load. Please try again.")).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByTestId("discover-search-results")).not.toBeVisible()
  fail = false
  await page.getByRole("button", { name: "Retry", exact: true }).click()
  await expect(page.getByTestId("discover-search-results")).toBeVisible()
})
