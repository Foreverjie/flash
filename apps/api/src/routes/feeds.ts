/**
 * Feeds Routes
 * RSS feed management with RSS adapter integration
 */
import { zValidator } from "@hono/zod-validator"
import { and, eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { db, feeds, posts, subscriptions } from "../db/index.js"
import { rssManager } from "../lib/rss/index.js"
import { requireAuth } from "../middleware/auth.js"
import { logger } from "../utils/logger.js"
import { sendError, sendNotFound, structuredSuccess } from "../utils/response.js"

// Helper to generate IDs
const generateId = () => `feed_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const generatePostId = () => `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

// Route types
type FeedsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

// Validation schemas
const createFeedSchema = z.object({
  url: z.string().url("Invalid feed URL"),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
})

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
  isPrivate: z.boolean().default(false),
})

const feedsRouter = new Hono<{ Variables: FeedsVariables }>()

/**
 * GET /feeds
 * List feeds with pagination
 */
feedsRouter.get(
  "/",
  zValidator(
    "query",
    z.object({
      page: z
        .string()
        .optional()
        .transform((v) => Number(v) || 1),
      limit: z
        .string()
        .optional()
        .transform((v) => Math.min(Number(v) || 20, 100)),
      search: z.string().optional(),
    }),
  ),
  async (c) => {
    const { page, limit } = c.req.valid("query")
    const offset = (page - 1) * limit

    const feedsList = await db.query.feeds.findMany({
      limit,
      offset,
      orderBy: (feeds, { desc }) => [desc(feeds.createdAt)],
    })

    const totalFeeds = await db.query.feeds.findMany()

    return c.json(
      structuredSuccess({
        data: feedsList,
        page,
        limit,
        total: totalFeeds.length,
        hasMore: offset + limit < totalFeeds.length,
      }),
    )
  },
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
    const { url, title, description } = c.req.valid("json")

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
        id: generateId(),
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
        id: generatePostId(),
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
 * POST /feeds/:id/refresh
 * Manually refresh a feed
 */
feedsRouter.post(
  "/:id/refresh",
  requireAuth,
  zValidator("param", z.object({ id: z.string().min(1) })),
  async (c) => {
    try {
      const { id } = c.req.valid("param")

      const feed = await db.query.feeds.findFirst({
        where: eq(feeds.id, id),
      })

      if (!feed) {
        return sendNotFound(c, "Feed")
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
            id: generatePostId(),
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
  },
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
    const { feedId, title, category, isPrivate } = c.req.valid("json")

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

    // Create subscription
    const [subscription] = await db
      .insert(subscriptions)
      .values({
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId: user.id,
        feedId,
        title,
        category,
        isPrivate,
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
