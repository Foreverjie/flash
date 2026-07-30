import { beforeEach, describe, expect, it, vi } from "vitest"

const { selectMock, findUserMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  findUserMock: vi.fn(),
}))

vi.mock("../db/index.js", () => ({
  db: { select: selectMock, query: { users: { findFirst: findUserMock } } },
  feeds: { id: "feeds.id", adapterType: "feeds.adapter_type" },
  users: { id: "users.id" },
  subscriptions: {
    userId: "subscriptions.user_id",
    feedId: "subscriptions.feed_id",
    view: "subscriptions.view",
    isPrivate: "subscriptions.is_private",
  },
}))

/**
 * `resolveRequestedFeedViews` issues at most two selects: the user's
 * subscription rows, then (only when some requested feed is unsubscribed) the
 * feed rows. Queue the results in that order.
 */
const queueSelects = (...results: unknown[][]) => {
  selectMock.mockReset()
  for (const rows of results) {
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    })
  }
}

describe("resolveRequestedFeedViews", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("resolves an unsubscribed feed from its adapter type", async () => {
    queueSelects([], [{ id: "feed-x", adapterType: "x_timeline" }])
    const { resolveRequestedFeedViews } = await import("./subscription-service.js")

    const views = await resolveRequestedFeedViews({
      userId: "user-1",
      feedIds: ["feed-x"],
    })

    // SocialMedia(1) — Discover previews entries before you follow the feed.
    expect([...views]).toEqual([["feed-x", 1]])
  })

  it("prefers the subscription's view over the adapter default", async () => {
    queueSelects([{ feedId: "feed-x", view: 5, isPrivate: false }])
    const { resolveRequestedFeedViews } = await import("./subscription-service.js")

    const views = await resolveRequestedFeedViews({
      userId: "user-1",
      feedIds: ["feed-x"],
    })

    expect(views.get("feed-x")).toBe(5)
    expect(selectMock).toHaveBeenCalledTimes(1)
  })

  it("does not resurrect a private subscription via the adapter fallback", async () => {
    queueSelects([{ feedId: "feed-x", view: 1, isPrivate: true }])
    const { resolveRequestedFeedViews } = await import("./subscription-service.js")

    const views = await resolveRequestedFeedViews({
      userId: "user-1",
      feedIds: ["feed-x"],
      excludePrivate: true,
    })

    expect(views.size).toBe(0)
    expect(selectMock).toHaveBeenCalledTimes(1)
  })

  it("drops unsubscribed feeds whose adapter view does not match the filter", async () => {
    queueSelects([], [{ id: "feed-rss", adapterType: null }])
    const { resolveRequestedFeedViews } = await import("./subscription-service.js")

    const views = await resolveRequestedFeedViews({
      userId: "user-1",
      view: 3,
      feedIds: ["feed-rss"],
    })

    // feed-rss resolves to Articles(0), which is not the requested Videos(3).
    expect(views.size).toBe(0)
  })

  it("returns every subscribed feed when no ids are requested", async () => {
    queueSelects([
      { feedId: "feed-a", view: 0, isPrivate: false },
      { feedId: "feed-b", view: 3, isPrivate: false },
    ])
    const { resolveRequestedFeedViews } = await import("./subscription-service.js")

    const views = await resolveRequestedFeedViews({ userId: "user-1" })

    expect([...views]).toEqual([
      ["feed-a", 0],
      ["feed-b", 3],
    ])
    expect(selectMock).toHaveBeenCalledTimes(1)
  })
})

/** Queue the single count(*) select that getSubscriptionUsage issues. */
const queueUsage = (used: number, subscriptionLimit: number | null = null) => {
  selectMock.mockReset()
  selectMock.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ value: used }]),
    }),
  })
  findUserMock.mockReset()
  findUserMock.mockResolvedValue({ subscriptionLimit })
}

describe("subscription quota", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("reports usage against the default limit", async () => {
    queueUsage(62)
    const { getSubscriptionUsage, DEFAULT_SUBSCRIPTION_LIMIT } = await import(
      "./subscription-service.js"
    )

    expect(await getSubscriptionUsage("user-1")).toEqual({
      used: 62,
      limit: DEFAULT_SUBSCRIPTION_LIMIT,
    })
  })

  it("honours a per-user limit override", async () => {
    queueUsage(120, 500)
    const { getSubscriptionUsage } = await import("./subscription-service.js")

    expect(await getSubscriptionUsage("user-1")).toEqual({ used: 120, limit: 500 })
  })

  it("allows a subscribe that lands exactly on the limit", async () => {
    queueUsage(99)
    const { assertSubscriptionCapacity } = await import("./subscription-service.js")

    await expect(assertSubscriptionCapacity("user-1")).resolves.toBeUndefined()
  })

  it("rejects a subscribe that would exceed the limit", async () => {
    queueUsage(100)
    const { assertSubscriptionCapacity, isSubscriptionQuotaError } = await import(
      "./subscription-service.js"
    )

    const error = await assertSubscriptionCapacity("user-1").catch((e: unknown) => e)
    expect(isSubscriptionQuotaError(error)).toBe(true)
    expect((error as { used: number; limit: number }).used).toBe(100)
    expect((error as { used: number; limit: number }).limit).toBe(100)
  })

  it("rejects a bulk add that would overshoot even when there is some room", async () => {
    queueUsage(95)
    const { assertSubscriptionCapacity, isSubscriptionQuotaError } = await import(
      "./subscription-service.js"
    )

    const error = await assertSubscriptionCapacity("user-1", 10).catch((e: unknown) => e)
    expect(isSubscriptionQuotaError(error)).toBe(true)
  })

  it("reports remaining capacity for bulk callers to clamp against", async () => {
    queueUsage(95)
    const { getRemainingSubscriptionCapacity } = await import("./subscription-service.js")

    expect(await getRemainingSubscriptionCapacity("user-1")).toBe(5)
  })

  it("clamps remaining capacity at zero when already over the limit", async () => {
    queueUsage(140, 100)
    const { getRemainingSubscriptionCapacity } = await import("./subscription-service.js")

    expect(await getRemainingSubscriptionCapacity("user-1")).toBe(0)
  })
})
