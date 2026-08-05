import { beforeEach, describe, expect, it, vi } from "vitest"

import { apiContext } from "../../context"
import type { FollowAPI } from "../../types"
import { useUserStore } from "../user/store"
import { feedSyncServices, useFeedStore } from "./store"
import type { FeedModel } from "./types"

const createFeed = (overrides: Partial<FeedModel> & { id: string }): FeedModel => ({
  type: "feed",
  title: "Example",
  url: "https://example.com/rss.xml",
  description: null,
  image: null,
  errorAt: null,
  siteUrl: null,
  ownerUserId: null,
  errorMessage: null,
  subscriptionCount: null,
  updatesPerWeek: null,
  latestEntryPublishedAt: null,
  tipUserIds: null,
  updatedAt: null,
  ...overrides,
})

const setWhoami = (userId: string | null) => {
  useUserStore.setState((state) => ({
    ...state,
    whoami: userId ? ({ id: userId } as never) : null,
  }))
}

describe("feedSyncServices.refreshFeed", () => {
  let refresh: ReturnType<typeof vi.fn>

  beforeEach(() => {
    refresh = vi.fn().mockResolvedValue({ code: 0, data: {} })
    apiContext.provide({ feeds: { refresh } } as unknown as FollowAPI)
    useFeedStore.setState({ feeds: {} }, true)
    setWhoami("user-1")
  })

  it("refreshes a scraper-backed feed for any subscriber", async () => {
    useFeedStore.setState({
      feeds: {
        "feed-1": createFeed({
          id: "feed-1",
          url: "leyoujia_community://9575",
          ownerUserId: "someone-else",
        }),
      },
    })

    await expect(feedSyncServices.refreshFeed("feed-1")).resolves.toBe(true)
    expect(refresh).toHaveBeenCalledWith({ id: "feed-1" })
  })

  it("refreshes an ordinary RSS feed the user owns", async () => {
    useFeedStore.setState({
      feeds: { "feed-1": createFeed({ id: "feed-1", ownerUserId: "user-1" }) },
    })

    await expect(feedSyncServices.refreshFeed("feed-1")).resolves.toBe(true)
    expect(refresh).toHaveBeenCalledWith({ id: "feed-1" })
  })

  it("leaves someone else's RSS feed to the server scheduler", async () => {
    useFeedStore.setState({
      feeds: { "feed-1": createFeed({ id: "feed-1", ownerUserId: "someone-else" }) },
    })

    await expect(feedSyncServices.refreshFeed("feed-1")).resolves.toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })

  it("does nothing for a feed that is not in the store", async () => {
    await expect(feedSyncServices.refreshFeed("missing")).resolves.toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })
})
