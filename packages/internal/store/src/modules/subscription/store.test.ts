import { FeedViewType } from "@follow/constants"
import { beforeEach, describe, expect, it } from "vitest"

import { createSubscriptionState, subscriptionActions, useSubscriptionStore } from "./store"
import type { SubscriptionModel } from "./types"

const createFeedSubscription = ({
  feedId,
  view,
  category,
}: {
  feedId: string
  view: FeedViewType
  category: string | null
}): SubscriptionModel => ({
  feedId,
  listId: null,
  inboxId: null,
  userId: "user-1",
  view,
  isPrivate: false,
  hideFromTimeline: false,
  title: null,
  category,
  createdAt: new Date(0).toISOString(),
  type: "feed",
})

describe("subscription indexes", () => {
  beforeEach(() => {
    useSubscriptionStore.setState(createSubscriptionState(), true)
  })

  it("keeps feed, list, and category indexes independent", async () => {
    await subscriptionActions.upsertManyInSession([
      createFeedSubscription({
        feedId: "article-feed",
        view: FeedViewType.Articles,
        category: "Engineering",
      }),
      createFeedSubscription({
        feedId: "video-feed",
        view: FeedViewType.Videos,
        category: "Watch later",
      }),
    ])

    const state = useSubscriptionStore.getState()
    expect([...state.feedIdByView[FeedViewType.Articles]]).toEqual(["article-feed"])
    expect([...state.feedIdByView[FeedViewType.Videos]]).toEqual(["video-feed"])
    expect([...state.feedIdByView[FeedViewType.All]]).toEqual(["article-feed", "video-feed"])
    expect([...state.listIdByView[FeedViewType.Articles]]).toEqual([])
    expect([...state.categories[FeedViewType.Articles]]).toEqual(["Engineering"])
    expect([...state.categories[FeedViewType.Videos]]).toEqual(["Watch later"])
  })

  it("removes stale indexes when an existing feed changes view", async () => {
    await subscriptionActions.upsertManyInSession([
      createFeedSubscription({
        feedId: "feed-1",
        view: FeedViewType.Articles,
        category: "Reading",
      }),
    ])
    await subscriptionActions.upsertManyInSession([
      createFeedSubscription({
        feedId: "feed-1",
        view: FeedViewType.Videos,
        category: "Watching",
      }),
    ])

    const state = useSubscriptionStore.getState()
    expect([...state.feedIdByView[FeedViewType.Articles]]).toEqual([])
    expect([...state.categories[FeedViewType.Articles]]).toEqual([])
    expect([...state.feedIdByView[FeedViewType.Videos]]).toEqual(["feed-1"])
    expect([...state.categories[FeedViewType.Videos]]).toEqual(["Watching"])
  })
})
