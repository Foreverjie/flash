import { and, eq, inArray, sql } from "drizzle-orm"

import { db, feeds, subscriptions } from "../db/index.js"
import type { FeedView } from "../lib/feed-view.js"
import { resolveFeedView } from "../lib/feed-view.js"

type SubscriptionUpdate = Partial<
  Pick<
    typeof subscriptions.$inferInsert,
    "category" | "hideFromTimeline" | "isPrivate" | "title" | "view"
  >
>

export const normalizeCategory = (category: string | null | undefined) => {
  if (category === undefined) return
  if (category === null) return null

  const normalized = category.trim()
  return normalized.length > 0 ? normalized : null
}

export const getUserFeedSubscriptions = async ({
  userId,
  view,
  feedIds,
  excludePrivate = false,
}: {
  userId: string
  view?: FeedView
  feedIds?: string[]
  excludePrivate?: boolean
}) => {
  if (feedIds?.length === 0) return []

  const conditions = [eq(subscriptions.userId, userId)]
  if (view !== undefined) conditions.push(eq(subscriptions.view, view))
  if (feedIds) conditions.push(inArray(subscriptions.feedId, feedIds))
  if (excludePrivate) conditions.push(eq(subscriptions.isPrivate, false))

  return db
    .select({
      feedId: subscriptions.feedId,
      view: subscriptions.view,
      isPrivate: subscriptions.isPrivate,
    })
    .from(subscriptions)
    .where(and(...conditions))
}

/**
 * Resolves feedId -> view for a request, as a map.
 *
 * When the caller names feeds explicitly (`feedId` / `feedIdList`), feeds the
 * user has no subscription for still resolve — Discover previews entries for
 * feeds before you follow them. Their view comes from the feed's adapter type.
 * Without explicit ids, this is exactly the user's subscribed feeds.
 */
export const resolveRequestedFeedViews = async ({
  userId,
  view,
  feedIds,
  excludePrivate = false,
}: {
  userId: string
  view?: FeedView
  feedIds?: string[]
  excludePrivate?: boolean
}) => {
  if (!feedIds) {
    const subscribed = await getUserFeedSubscriptions({ userId, view, excludePrivate })
    return new Map(subscribed.map((s) => [s.feedId, s.view] as const))
  }
  if (feedIds.length === 0) return new Map<string, FeedView>()

  // Unfiltered so we can tell "not subscribed" apart from "filtered out".
  const subscribed = await getUserFeedSubscriptions({ userId, feedIds })
  const subscribedFeedIds = new Set(subscribed.map((s) => s.feedId))

  const viewByFeedId = new Map(
    subscribed
      .filter((s) => (view === undefined || s.view === view) && !(excludePrivate && s.isPrivate))
      .map((s) => [s.feedId, s.view] as const),
  )

  const unsubscribed = feedIds.filter((feedId) => !subscribedFeedIds.has(feedId))
  if (unsubscribed.length === 0) return viewByFeedId

  const unsubscribedFeeds = await db
    .select({ id: feeds.id, adapterType: feeds.adapterType })
    .from(feeds)
    .where(inArray(feeds.id, unsubscribed))

  for (const feed of unsubscribedFeeds) {
    const resolved = resolveFeedView(feed.adapterType)
    if (view === undefined || resolved === view) viewByFeedId.set(feed.id, resolved)
  }

  return viewByFeedId
}

export const updateUserFeedSubscriptions = async ({
  userId,
  feedIds,
  data,
}: {
  userId: string
  feedIds: string[]
  data: SubscriptionUpdate
}) => {
  if (feedIds.length === 0) return []

  return db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.feedId, feedIds)))
    .returning()
}

export const deleteUserFeedSubscriptions = async (userId: string, feedIds: string[]) => {
  if (feedIds.length === 0) return []

  return db.transaction(async (tx) => {
    const deleted = await tx
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.feedId, feedIds)))
      .returning({ feedId: subscriptions.feedId })

    const deletedFeedIds = deleted.map((subscription) => subscription.feedId)
    if (deletedFeedIds.length > 0) {
      await tx
        .update(feeds)
        .set({
          subscriptionCount: sql`GREATEST(COALESCE(${feeds.subscriptionCount}, 0) - 1, 0)`,
        })
        .where(inArray(feeds.id, deletedFeedIds))
    }

    return deleted
  })
}
