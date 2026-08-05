/**
 * Feeds Routes
 * RSS feed management with RSS adapter integration
 */
import { zValidator } from "@hono/zod-validator"
import { and, count, eq, sql } from "drizzle-orm"
import type { Context } from "hono"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { db, feeds, posts, subscriptions } from "../db/index.js"
import { resolveFeedView, resolveSubscriptionView } from "../lib/feed-view.js"
import { rssManager } from "../lib/rss/index.js"
import {
  isScraplingAdapterType,
  scrapingClient,
  ScrapingServiceUnavailableError,
} from "../lib/scraping-client.js"
import { requireAuth } from "../middleware/auth.js"
import {
  assertSubscriptionCapacity,
  isSubscriptionQuotaError,
} from "../services/subscription-service.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"
import { sendError, sendNotFound, structuredSuccess } from "../utils/response.js"

// Route types
type FeedsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

// Validation schemas
// z.union (not discriminatedUnion) — discriminatedUnion requires a required literal
// on each member, which would break existing callers that omit `type` entirely.
const createFeedSchema = z.union([
  // Standard RSS feed (existing callers omit `type`)
  z.object({
    type: z.literal("rss").optional(),
    url: z.string().url("Invalid feed URL"),
    title: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
  }),
  // X timeline feed — user provides a handle (e.g. "elonmusk" or "@elonmusk")
  z.object({
    type: z.literal("x_timeline"),
    handle: z
      .string()
      .min(1)
      .max(50)
      .transform((h) => h.replace(/^@/, "")), // strip leading @
    title: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal("bilibili_up_video"),
    uid: z.string().regex(/^\d+$/, "Invalid Bilibili UID"),
    title: z.string().max(200).optional(),
  }),
  // Community resale-listing watchers — id from the community page URL, e.g.
  // https://shenzhen.leyoujia.com/xq/detail/9575 or https://shenzhen.qfang.com/garden/sale/57558
  z.object({
    type: z.enum(["leyoujia_community", "qfang_community"]),
    communityId: z.string().regex(/^\d+$/, "Invalid community id"),
    title: z.string().max(200).optional(),
  }),
])

const updateFeedSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  adapterType: z.string().max(50).optional(),
  adapterConfig: z.record(z.unknown()).optional(),
})

const subscribeSchema = z.object({
  feedId: z.string().min(1),
  title: z.string().max(200).optional(),
  category: z.string().max(100).optional(),
  view: z.number().int().min(0).max(5).optional(),
  isPrivate: z.boolean().default(false),
  hideFromTimeline: z.boolean().default(false),
})

const getFeedSchema = z.object({
  id: z.string().min(1).optional(),
  url: z.string().min(1).optional(),
  entriesLimit: z.coerce
    .number()
    .int()
    .min(1)
    .transform((value) => Math.min(value, 50))
    .default(10),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .transform((value) => Math.min(value, 100))
    .default(20),
  search: z.string().optional(),
})

const feedsRouter = new Hono<{ Variables: FeedsVariables }>()

function getScrapingSource(feed: { adapterType: string | null; url: string }) {
  if (feed.adapterType && isScraplingAdapterType(feed.adapterType)) {
    return feed.url.replace(`${feed.adapterType}://`, "")
  }

  return ""
}

/**
 * GET /feeds
 * The client SDK uses this endpoint for a feed detail lookup. Keep the legacy
 * paginated response only when neither `id` nor `url` is provided.
 */
feedsRouter.get("/", zValidator("query", getFeedSchema), async (c) => {
  const { id, url, entriesLimit, page, limit } = c.req.valid("query")

  if (id || url) {
    const feed = await db.query.feeds.findFirst({
      where: id ? eq(feeds.id, id) : eq(feeds.url, url!),
    })

    if (!feed) return sendNotFound(c, "Feed")

    const [recentPosts, subscription] = await Promise.all([
      db.query.posts.findMany({
        where: eq(posts.feedId, feed.id),
        limit: entriesLimit,
        orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
      }),
      c.get("user")
        ? db.query.subscriptions.findFirst({
            where: and(
              eq(subscriptions.userId, c.get("user")!.id),
              eq(subscriptions.feedId, feed.id),
            ),
          })
        : Promise.resolve(),
    ])

    const view = subscription?.view ?? resolveFeedView(feed.adapterType)
    return c.json(
      structuredSuccess({
        feed,
        entries: recentPosts,
        subscription,
        readCount: 0,
        subscriptionCount: feed.subscriptionCount ?? 0,
        analytics: {
          feedId: feed.id,
          subscriptionCount: feed.subscriptionCount ?? 0,
          updatesPerWeek: feed.updatesPerWeek,
          latestEntryPublishedAt: recentPosts.at(0)?.publishedAt ?? null,
          view,
        },
      }),
    )
  }

  const offset = (page - 1) * limit

  const feedsList = await db.query.feeds.findMany({
    limit,
    offset,
    orderBy: (feeds, { desc }) => [desc(feeds.createdAt)],
  })

  const [totalRow] = await db.select({ value: count() }).from(feeds)
  const total = totalRow?.value ?? 0

  return c.json(
    structuredSuccess({
      data: feedsList,
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    }),
  )
})

/**
 * GET /feeds/refresh?id=…
 * The client SDK's refresh route. Registered before `GET /:id` so the literal
 * path is not matched as a feed id.
 */
feedsRouter.get(
  "/refresh",
  requireAuth,
  zValidator("query", z.object({ id: z.string().min(1) })),
  (c) => handleFeedRefresh(c, c.req.valid("query").id),
)

/**
 * GET /feeds/reset?id=…
 * The client SDK's reset route. Registered before `GET /:id` for the same
 * reason as `/refresh` — otherwise "reset" is matched as a feed id.
 */
feedsRouter.get(
  "/reset",
  requireAuth,
  zValidator("query", z.object({ id: z.string().min(1) })),
  (c) => handleFeedReset(c, c.req.valid("query").id),
)

/**
 * GET /feeds/:id
 * Get feed by ID with recent posts
 */
feedsRouter.get("/:id", zValidator("param", z.object({ id: z.string().min(1) })), async (c) => {
  const { id } = c.req.valid("param")

  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, id),
    with: {
      posts: {
        limit: 10,
        orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
      },
    },
  })

  if (!feed) {
    return sendNotFound(c, "Feed")
  }

  return c.json(structuredSuccess({ feed }))
})

/**
 * POST /feeds
 * Create or discover a new feed
 */
feedsRouter.post("/", requireAuth, zValidator("json", createFeedSchema), async (c) => {
  try {
    const user = c.get("user")
    const body = c.req.valid("json")

    if (body.type && body.type !== "rss") {
      let source: string
      let defaultTitle: string
      let adapterConfig: Record<string, string>
      switch (body.type) {
        case "x_timeline": {
          source = body.handle
          defaultTitle = `@${body.handle} on X`
          adapterConfig = { handle: body.handle }
          break
        }
        case "bilibili_up_video": {
          source = body.uid
          defaultTitle = `Bilibili UP ${body.uid}`
          adapterConfig = { uid: body.uid }
          break
        }
        case "leyoujia_community":
        case "qfang_community": {
          source = body.communityId
          defaultTitle =
            body.type === "leyoujia_community"
              ? `乐有家小区 ${body.communityId}`
              : `Q房网小区 ${body.communityId}`
          adapterConfig = { communityId: body.communityId }
          break
        }
      }
      const syntheticUrl = `${body.type}://${source}`

      const existing = await db.query.feeds.findFirst({
        where: eq(feeds.url, syntheticUrl),
      })

      if (existing) {
        return c.json(structuredSuccess({ feed: existing, isNew: false }))
      }

      const feedId = generateSnowflakeId()
      const [newFeed] = await db
        .insert(feeds)
        .values({
          id: feedId,
          url: syntheticUrl,
          title: body.title ?? defaultTitle,
          adapterType: body.type,
          adapterConfig,
        })
        .returning()

      if (!newFeed) {
        return sendError(c, "Failed to create feed", 500, 500)
      }

      return c.json(structuredSuccess({ feed: newFeed, isNew: true }), 201)
    }

    // --- RSS path below (body.type is "rss" or undefined) ---
    // Safe to destructure url/title/description now that x_timeline is handled above
    const { url, title, description } = body

    // Check if feed already exists
    const existingFeed = await db.query.feeds.findFirst({
      where: eq(feeds.url, url),
    })

    if (existingFeed) {
      return c.json(structuredSuccess({ feed: existingFeed, existed: true }))
    }

    // Fetch and validate the feed
    const result = await rssManager.fetch(url)

    if (!result.success || !result.data) {
      return sendError(c, result.error || "Invalid feed URL", 400, 400)
    }

    const feedData = result.data

    // Create new feed
    const [newFeed] = await db
      .insert(feeds)
      .values({
        id: generateSnowflakeId(),
        url,
        title: title || feedData.title,
        description: description || feedData.description,
        siteUrl: feedData.siteUrl,
        image: feedData.image,
        language: feedData.language,
        lastBuildDate: feedData.lastBuildDate,
        ttl: feedData.ttl,
        lastFetchedAt: new Date(),
        ownerUserId: user?.id,
      })
      .returning()

    if (!newFeed) {
      return sendError(c, "Failed to create feed", 500, 500)
    }

    // Insert initial posts
    if (feedData.items.length > 0) {
      const postsToInsert = feedData.items.slice(0, 50).map((item) => ({
        id: generateSnowflakeId(),
        feedId: newFeed.id,
        guid: item.guid,
        title: item.title,
        url: item.url,
        description: item.description,
        content: item.content,
        author: item.author,
        authorUrl: item.authorUrl,
        authorAvatar: item.authorAvatar,
        publishedAt: item.publishedAt,
        media: item.media,
        attachments: item.attachments,
        categories: item.categories,
        formattedContent: item.formattedContent,
        language: feedData.language,
        extra: item.extra,
      }))

      await db.insert(posts).values(postsToInsert).onConflictDoNothing()
    }

    logger.info(`[Feeds] New feed created: ${url} by user ${user?.id}`)

    return c.json(structuredSuccess({ feed: newFeed, existed: false }), 201)
  } catch (error) {
    logger.error("[Feeds] Create error:", error)
    return sendError(c, "Failed to create feed", 500, 500)
  }
})

/**
 * PATCH /feeds/:id
 * Update feed metadata
 */
feedsRouter.patch(
  "/:id",
  requireAuth,
  zValidator("param", z.object({ id: z.string().min(1) })),
  zValidator("json", updateFeedSchema),
  async (c) => {
    try {
      const user = c.get("user")
      const { id } = c.req.valid("param")
      const updates = c.req.valid("json")

      const feed = await db.query.feeds.findFirst({
        where: eq(feeds.id, id),
      })

      if (!feed) {
        return sendNotFound(c, "Feed")
      }

      // Check ownership (only owner or admin can update)
      if (feed.ownerUserId !== user?.id && user?.role !== "admin") {
        return sendError(c, "Not authorized to update this feed", 403, 403)
      }

      const [updatedFeed] = await db
        .update(feeds)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(feeds.id, id))
        .returning()

      return c.json(structuredSuccess({ feed: updatedFeed }))
    } catch (error) {
      logger.error("[Feeds] Update error:", error)
      return sendError(c, "Failed to update feed", 500, 500)
    }
  },
)

/**
 * DELETE /feeds/:id
 * Delete a feed
 */
feedsRouter.delete(
  "/:id",
  requireAuth,
  zValidator("param", z.object({ id: z.string().min(1) })),
  async (c) => {
    try {
      const user = c.get("user")
      const { id } = c.req.valid("param")

      const feed = await db.query.feeds.findFirst({
        where: eq(feeds.id, id),
      })

      if (!feed) {
        return sendNotFound(c, "Feed")
      }

      // Check ownership (only owner or admin can delete)
      if (feed.ownerUserId !== user?.id && user?.role !== "admin") {
        return sendError(c, "Not authorized to delete this feed", 403, 403)
      }

      await db.delete(feeds).where(eq(feeds.id, id))

      logger.info(`[Feeds] Feed deleted: ${id} by user ${user?.id}`)

      return c.json(structuredSuccess({ message: "Feed deleted successfully" }))
    } catch (error) {
      logger.error("[Feeds] Delete error:", error)
      return sendError(c, "Failed to delete feed", 500, 500)
    }
  },
)

/**
 * Fetch a feed's source and persist any new posts.
 *
 * Shared by both refresh entry points: the client SDK calls
 * `GET /feeds/refresh?id=…`, while `POST /feeds/:id/refresh` is the RESTful
 * form kept for existing callers and scripts.
 */
async function handleFeedRefresh(c: Context<{ Variables: FeedsVariables }>, id: string) {
  try {
    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, id),
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    // Delegate to Python scraping service for scraper-backed feeds
    if (feed.adapterType && isScraplingAdapterType(feed.adapterType)) {
      const source = getScrapingSource(feed)
      if (!source) {
        return sendError(c, `Malformed ${feed.adapterType} URL`, 400, 400)
      }
      try {
        const result = await scrapingClient.scrape({
          feedId: feed.id,
          adapterType: feed.adapterType,
          source,
        })
        await db
          .update(feeds)
          .set({ lastFetchedAt: new Date(), errorAt: null, errorMessage: null })
          .where(eq(feeds.id, feed.id))
        return c.json(structuredSuccess({ message: "Feed refreshed", newPosts: result.inserted }))
      } catch (err) {
        logger.error(`[Feeds] Scraping service error for feed ${id}:`, err)

        // The scraper being down says nothing about the feed. Recording it as a
        // feed error would show every subscriber a broken feed because of a
        // server-side outage — so report 503 and leave the feed's state alone.
        if (err instanceof ScrapingServiceUnavailableError) {
          return sendError(c, err.message, 503, 503)
        }

        await db
          .update(feeds)
          .set({
            errorAt: new Date(),
            errorMessage: err instanceof Error ? err.message : "Scraping failed",
          })
          .where(eq(feeds.id, id))
        return sendError(c, "Failed to scrape this feed", 502, 502)
      }
    }

    // Fetch latest content
    const result = await rssManager.fetch(feed.url)

    if (!result.success || !result.data) {
      // Update error status
      await db
        .update(feeds)
        .set({
          errorAt: new Date(),
          errorMessage: result.error || "Failed to fetch feed",
        })
        .where(eq(feeds.id, id))

      return sendError(c, result.error || "Failed to refresh feed", 400, 400)
    }

    const feedData = result.data

    // Update feed metadata
    await db
      .update(feeds)
      .set({
        title: feedData.title || feed.title,
        description: feedData.description || feed.description,
        image: feedData.image || feed.image,
        lastFetchedAt: new Date(),
        lastBuildDate: feedData.lastBuildDate,
        errorAt: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, id))

    // Insert new posts (upsert)
    let newPostsCount = 0
    for (const item of feedData.items) {
      const existingPost = await db.query.posts.findFirst({
        where: and(eq(posts.feedId, id), eq(posts.guid, item.guid)),
      })

      if (!existingPost) {
        await db.insert(posts).values({
          id: generateSnowflakeId(),
          feedId: id,
          guid: item.guid,
          title: item.title,
          url: item.url,
          description: item.description,
          content: item.content,
          author: item.author,
          authorUrl: item.authorUrl,
          authorAvatar: item.authorAvatar,
          publishedAt: item.publishedAt,
          media: item.media,
          attachments: item.attachments,
          categories: item.categories,
          formattedContent: item.formattedContent,
          language: feedData.language,
          extra: item.extra,
        })
        newPostsCount++
      }
    }

    logger.info(`[Feeds] Feed refreshed: ${id}, ${newPostsCount} new posts`)

    return c.json(
      structuredSuccess({
        message: "Feed refreshed successfully",
        newPosts: newPostsCount,
      }),
    )
  } catch (error) {
    logger.error("[Feeds] Refresh error:", error)
    return sendError(c, "Failed to refresh feed", 500, 500)
  }
}

/**
 * POST /feeds/:id/refresh
 * Manually refresh a feed
 */
feedsRouter.post(
  "/:id/refresh",
  requireAuth,
  zValidator("param", z.object({ id: z.string().min(1) })),
  (c) => handleFeedRefresh(c, c.req.valid("param").id),
)

/**
 * Clear a feed's cached fetch state and immediately re-pull the source.
 *
 * Deliberately non-destructive: stored posts (and every subscriber's read
 * history) are left alone. What resets is the polling state — the error flags
 * and the `lastFetchedAt` / `lastBuildDate` watermarks the scheduler uses to
 * decide a feed is fresh — so a feed wedged by a transient upstream failure
 * starts clean instead of staying parked until its next natural poll.
 *
 * Owner-only, matching the desktop context menu that exposes it.
 */
async function handleFeedReset(c: Context<{ Variables: FeedsVariables }>, id: string) {
  try {
    const user = c.get("user")

    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, id),
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    if (feed.ownerUserId !== user?.id && user?.role !== "admin") {
      return sendError(c, "Not authorized to reset this feed", 403, 403)
    }

    await db
      .update(feeds)
      .set({
        errorAt: null,
        errorMessage: null,
        lastFetchedAt: null,
        lastBuildDate: null,
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, id))

    logger.info(`[Feeds] Feed reset: ${id} by user ${user?.id}`)

    // Re-pull straight away so the caller sees the effect without waiting for
    // the scheduler. Its response already carries the new-post count.
    return await handleFeedRefresh(c, id)
  } catch (error) {
    logger.error("[Feeds] Reset error:", error)
    return sendError(c, "Failed to reset feed", 500, 500)
  }
}

/**
 * POST /feeds/:id/reset
 * RESTful form of the reset action, kept alongside the SDK's GET route.
 */
feedsRouter.post(
  "/:id/reset",
  requireAuth,
  zValidator("param", z.object({ id: z.string().min(1) })),
  (c) => handleFeedReset(c, c.req.valid("param").id),
)

/**
 * POST /feeds/discover
 * Discover RSS feeds from a website URL
 */
feedsRouter.post(
  "/discover",
  zValidator("json", z.object({ url: z.string().url() })),
  async (c) => {
    try {
      const { url } = c.req.valid("json")

      const discoveredFeeds = await rssManager.discover(url)

      return c.json(structuredSuccess({ feeds: discoveredFeeds }))
    } catch (error) {
      logger.error("[Feeds] Discover error:", error)
      return sendError(c, "Failed to discover feeds", 500, 500)
    }
  },
)

/**
 * POST /feeds/validate
 * Validate a feed URL without creating it
 */
feedsRouter.post(
  "/validate",
  zValidator("json", z.object({ url: z.string().url() })),
  async (c) => {
    try {
      const { url } = c.req.valid("json")

      const validation = await rssManager.validate(url)

      return c.json(structuredSuccess(validation))
    } catch (error) {
      logger.error("[Feeds] Validate error:", error)
      return sendError(c, "Failed to validate feed", 500, 500)
    }
  },
)

/**
 * POST /feeds/subscribe
 * Subscribe to a feed
 */
feedsRouter.post("/subscribe", requireAuth, zValidator("json", subscribeSchema), async (c) => {
  try {
    const user = c.get("user")
    const { feedId, title, category, view, isPrivate, hideFromTimeline } = c.req.valid("json")

    if (!user) {
      return sendError(c, "User not found", 401, 401)
    }

    // Check if feed exists
    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, feedId),
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    // Check if already subscribed
    const existingSubscription = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, user.id), eq(subscriptions.feedId, feedId)),
    })

    if (existingSubscription) {
      return c.json(structuredSuccess({ subscription: existingSubscription, existed: true }))
    }

    try {
      await assertSubscriptionCapacity(user.id)
    } catch (error) {
      if (isSubscriptionQuotaError(error)) {
        return sendError(c, error.message, 403, 403)
      }
      throw error
    }

    // Create subscription
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        id: generateSnowflakeId(),
        userId: user.id,
        feedId,
        title,
        category,
        view: resolveSubscriptionView(view, feed.adapterType),
        isPrivate,
        hideFromTimeline,
      })
      .returning()

    // Increment feed subscription count
    await db
      .update(feeds)
      .set({
        subscriptionCount: sql`COALESCE(${feeds.subscriptionCount}, 0) + 1`,
      })
      .where(eq(feeds.id, feedId))

    logger.info(`[Feeds] User ${user.id} subscribed to feed ${feedId}`)

    return c.json(structuredSuccess({ subscription, existed: false }), 201)
  } catch (error) {
    logger.error("[Feeds] Subscribe error:", error)
    return sendError(c, "Failed to subscribe", 500, 500)
  }
})

/**
 * DELETE /feeds/subscribe/:feedId
 * Unsubscribe from a feed
 */
feedsRouter.delete(
  "/subscribe/:feedId",
  requireAuth,
  zValidator("param", z.object({ feedId: z.string().min(1) })),
  async (c) => {
    try {
      const user = c.get("user")
      const { feedId } = c.req.valid("param")

      if (!user) {
        return sendError(c, "User not found", 401, 401)
      }

      const subscription = await db.query.subscriptions.findFirst({
        where: and(eq(subscriptions.userId, user.id), eq(subscriptions.feedId, feedId)),
      })

      if (!subscription) {
        return sendNotFound(c, "Subscription")
      }

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

      logger.info(`[Feeds] User ${user.id} unsubscribed from feed ${feedId}`)

      return c.json(structuredSuccess({ message: "Unsubscribed successfully" }))
    } catch (error) {
      logger.error("[Feeds] Unsubscribe error:", error)
      return sendError(c, "Failed to unsubscribe", 500, 500)
    }
  },
)

/**
 * GET /feeds/:id/posts
 * Get posts for a feed
 */
feedsRouter.get(
  "/:id/posts",
  zValidator("param", z.object({ id: z.string().min(1) })),
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().positive().max(100).default(20),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid("param")
    const { page, limit } = c.req.valid("query")
    const offset = (page - 1) * limit

    const feed = await db.query.feeds.findFirst({
      where: eq(feeds.id, id),
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    const feedPosts = await db.query.posts.findMany({
      where: eq(posts.feedId, id),
      limit,
      offset,
      orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
    })

    const totalPosts = await db.query.posts.findMany({
      where: eq(posts.feedId, id),
    })

    return c.json(
      structuredSuccess({
        data: feedPosts,
        page,
        limit,
        total: totalPosts.length,
        hasMore: offset + limit < totalPosts.length,
      }),
    )
  },
)

export default feedsRouter
