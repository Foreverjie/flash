import { beforeEach, describe, expect, it, vi } from "vitest"

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }))

vi.mock("../db/index.js", () => ({
  db: { select: selectMock },
  feeds: { id: "feeds.id", adapterType: "feeds.adapter_type" },
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
