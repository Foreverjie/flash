/**
 * Subscriptions Routes
 * Returns user subscriptions with feed data in the format expected by the client SDK.
 */
import { and, eq, sql } from "drizzle-orm"
import { Hono } from "hono"

import type { User } from "../auth/index.js"
import { db, feeds, subscriptions } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"

type SubscriptionsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const subscriptionsRouter = new Hono<{ Variables: SubscriptionsVariables }>()

/**
 * Auto-subscribe a user to all existing feeds if they have no subscriptions.
 */
async function autoSubscribeIfEmpty(userId: string) {
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  })

  if (existing) return // User already has subscriptions

  const allFeeds = await db.query.feeds.findMany()
  if (allFeeds.length === 0) return

  const values = allFeeds.map((feed) => ({
    id: generateSnowflakeId(),
    userId,
    feedId: feed.id,
    title: null,
    category: null,
    isPrivate: false,
  }))

  await db.insert(subscriptions).values(values).onConflictDoNothing()
  logger.info(`[Subscriptions] Auto-subscribed user ${userId} to ${allFeeds.length} feeds`)
}

/**
 * GET /subscriptions
 * Returns the authenticated user's subscriptions with feed metadata.
 * Response shape matches SubscriptionWithFeed[] expected by apiMorph.toSubscription.
 */
subscriptionsRouter.get("/", requireAuth, async (c) => {
  const user = c.get("user")
  if (!user) {
    return c.json({ code: 0, data: [] })
  }

  // Auto-subscribe new users to existing feeds
  await autoSubscribeIfEmpty(user.id)

  const userSubscriptions = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, user.id),
    with: {
      feed: true,
    },
  })

  // Transform to SubscriptionWithFeed shape expected by the client
  const data = userSubscriptions.map((sub) => ({
    userId: sub.userId,
    feedId: sub.feedId,
    view: 1, // FeedViewType.Articles
    category: sub.category ?? "",
    isPrivate: sub.isPrivate ?? false,
    hideFromTimeline: null,
    title: sub.title,
    createdAt: sub.createdAt.toISOString(),
    feeds: {
      type: "feed" as const,
      id: sub.feed.id,
      url: sub.feed.url,
      title: sub.feed.title ?? "",
      description: sub.feed.description ?? "",
      siteUrl: sub.feed.siteUrl ?? "",
      image: sub.feed.image ?? "",
      errorAt: sub.feed.errorAt?.toISOString() ?? null,
      errorMessage: sub.feed.errorMessage ?? null,
      ownerUserId: sub.feed.ownerUserId ?? null,
    },
  }))

  return c.json({ code: 0, data })
})

/**
 * POST /subscriptions
 * Subscribe to a feed by URL or feedId.
 */
subscriptionsRouter.post("/", requireAuth, async (c) => {
  const user = c.get("user")
  if (!user) {
    return c.json({ code: 401, message: "Unauthorized" }, 401)
  }

  const body = await c.req.json()
  const { url, feedId, category, isPrivate, title } = body

  // Find the feed
  let feed
  if (feedId) {
    feed = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) })
  } else if (url) {
    feed = await db.query.feeds.findFirst({ where: eq(feeds.url, url) })

    // Auto-create X timeline feeds on first subscribe
    if (!feed && url.startsWith("x_timeline://")) {
      const handle = url.replace("x_timeline://", "").replace(/^@/, "")
      if (!handle) {
        return c.json({ code: 400, message: "Invalid X timeline handle" }, 400)
      }

      const [newFeed] = await db
        .insert(feeds)
        .values({
          id: generateSnowflakeId(),
          url,
          title: title ?? `@${handle} on X`,
          adapterType: "x_timeline",
          adapterConfig: { handle },
          ownerUserId: user.id,
        })
        .returning()

      feed = newFeed
      logger.info(`[Subscriptions] Auto-created X timeline feed for @${handle}`)
    }
  }

  if (!feed) {
    return c.json({ code: 404, message: "Feed not found" }, 404)
  }

  // Check if already subscribed
  const existing = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.userId, user.id), eq(subscriptions.feedId, feed.id)),
  })

  if (existing) {
    return c.json({ code: 0, feed, list: null, unread: {} })
  }

  await db.insert(subscriptions).values({
    id: generateSnowflakeId(),
    userId: user.id,
    feedId: feed.id,
    title: title ?? null,
    category: category ?? null,
    isPrivate: isPrivate ?? false,
  })

  // Increment feed subscription count
  await db
    .update(feeds)
    .set({
      subscriptionCount: sql`COALESCE(${feeds.subscriptionCount}, 0) + 1`,
    })
    .where(eq(feeds.id, feed.id))

  return c.json({ code: 0, feed, list: null, unread: {} })
})

/**
 * DELETE /subscriptions
 * Unsubscribe from a feed.
 */
subscriptionsRouter.delete("/", requireAuth, async (c) => {
  const user = c.get("user")
  if (!user) {
    return c.json({ code: 401, message: "Unauthorized" }, 401)
  }

  const body = await c.req.json()
  const { feedId } = body

  if (feedId) {
    await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.feedId, feedId)))

    // Decrement feed subscription count
    await db
      .update(feeds)
      .set({
        subscriptionCount: sql`GREATEST(COALESCE(${feeds.subscriptionCount}, 0) - 1, 0)`,
      })
      .where(eq(feeds.id, feedId))
  }

  return c.json({ code: 0, data: null })
})

export default subscriptionsRouter
