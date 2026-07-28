/**
 * Subscription routes. The subscription row is the source of truth for a
 * user's view and category; feed adapter inference is only used on creation.
 */
import { zValidator } from "@hono/zod-validator"
import { and, eq, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { db, feeds, subscriptions } from "../db/index.js"
import { isFeedView, resolveSubscriptionView } from "../lib/feed-view.js"
import { SCRAPLING_ADAPTER_TYPES } from "../lib/scraping-client.js"
import { requireAuth } from "../middleware/auth.js"
import {
  deleteUserFeedSubscriptions,
  normalizeCategory,
  updateUserFeedSubscriptions,
} from "../services/subscription-service.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"

type SubscriptionsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const subscriptionsRouter = new Hono<{ Variables: SubscriptionsVariables }>()

const feedViewSchema = z.number().int().min(0).max(5)
const categorySchema = z.string().trim().max(100).nullable()

const createSubscriptionSchema = z.object({
  url: z.string().min(1).optional(),
  feedId: z.string().min(1).optional(),
  view: feedViewSchema.optional(),
  category: categorySchema.optional(),
  isPrivate: z.boolean().optional(),
  hideFromTimeline: z.boolean().nullable().optional(),
  title: z.string().trim().max(200).nullable().optional(),
})

const updateSubscriptionSchema = z
  .object({
    feedId: z.string().min(1),
    view: feedViewSchema.optional(),
    category: categorySchema.optional(),
    isPrivate: z.boolean().optional(),
    hideFromTimeline: z.boolean().nullable().optional(),
    title: z.string().trim().max(200).nullable().optional(),
  })
  .refine(
    ({ feedId: _feedId, ...updates }) =>
      Object.values(updates).some((value) => value !== undefined),
    { message: "At least one subscription field is required" },
  )

const batchUpdateSubscriptionSchema = z
  .object({
    feedIds: z.array(z.string().min(1)).min(1).max(500),
    view: feedViewSchema.optional(),
    category: categorySchema.optional(),
    isPrivate: z.boolean().optional(),
    title: z.string().trim().max(200).nullable().optional(),
  })
  .refine(
    ({ feedIds: _feedIds, ...updates }) =>
      Object.values(updates).some((value) => value !== undefined),
    { message: "At least one subscription field is required" },
  )

// `listId` is accepted but unused: the client sends it when unsubscribing from
// a list-only selection, and list subscriptions are not modelled server-side yet.
// Rejecting it would fail the client's optimistic transaction.
const deleteSubscriptionSchema = z
  .object({
    feedIdList: z.array(z.string().min(1)).max(500).optional(),
    feedId: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    listId: z.string().min(1).optional(),
  })
  .refine(
    ({ feedIdList, feedId, url, listId }) => !!feedIdList?.length || !!feedId || !!url || !!listId,
    { message: "A feed identifier is required" },
  )

const toUpdateData = ({
  view,
  category,
  isPrivate,
  hideFromTimeline,
  title,
}: {
  view?: number
  category?: string | null
  isPrivate?: boolean
  hideFromTimeline?: boolean | null
  title?: string | null
}) => ({
  ...(view !== undefined && { view }),
  ...(category !== undefined && { category: normalizeCategory(category) }),
  ...(isPrivate !== undefined && { isPrivate }),
  ...(hideFromTimeline !== undefined && { hideFromTimeline: hideFromTimeline ?? false }),
  ...(title !== undefined && { title }),
})

subscriptionsRouter.get("/", requireAuth, async (c) => {
  const user = c.get("user")
  if (!user) return c.json({ code: 0, data: [] })

  const rawView = c.req.query("view")
  const requestedView = rawView === undefined ? undefined : Number(rawView)
  if (requestedView !== undefined && requestedView !== -1 && !isFeedView(requestedView)) {
    return c.json({ code: 400, message: "Invalid feed view" }, 400)
  }

  const userSubscriptions = await db.query.subscriptions.findMany({
    where:
      requestedView === undefined || requestedView === -1
        ? eq(subscriptions.userId, user.id)
        : and(eq(subscriptions.userId, user.id), eq(subscriptions.view, requestedView)),
    with: { feed: true },
  })

  const data = userSubscriptions.map((sub) => ({
    userId: sub.userId,
    feedId: sub.feedId,
    view: sub.view,
    category: sub.category,
    isPrivate: sub.isPrivate ?? false,
    hideFromTimeline: sub.hideFromTimeline ?? false,
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

subscriptionsRouter.post(
  "/",
  requireAuth,
  zValidator("json", createSubscriptionSchema),
  async (c) => {
    const user = c.get("user")
    if (!user) return c.json({ code: 401, message: "Unauthorized" }, 401)

    const { url, feedId, view, category, isPrivate, hideFromTimeline, title } = c.req.valid("json")

    let feed
    if (feedId) {
      feed = await db.query.feeds.findFirst({ where: eq(feeds.id, feedId) })
    } else if (url) {
      feed = await db.query.feeds.findFirst({ where: eq(feeds.url, url) })

      const adapterType = SCRAPLING_ADAPTER_TYPES.find((type) => url.startsWith(`${type}://`))
      if (!feed && adapterType) {
        let source = url.replace(`${adapterType}://`, "")
        if (adapterType === "x_timeline") source = source.replace(/^@/, "")
        if (!source) {
          return c.json({ code: 400, message: `Invalid ${adapterType} source` }, 400)
        }

        const defaultTitles: Record<typeof adapterType, string> = {
          x_timeline: `@${source} on X`,
          bilibili_up_video: `Bilibili UP ${source}`,
          leyoujia_community: `乐有家小区 ${source}`,
          qfang_community: `Q房网小区 ${source}`,
        }

        const [newFeed] = await db
          .insert(feeds)
          .values({
            id: generateSnowflakeId(),
            url: `${adapterType}://${source}`,
            title: title ?? defaultTitles[adapterType],
            adapterType,
            adapterConfig:
              adapterType === "x_timeline"
                ? { handle: source }
                : adapterType === "bilibili_up_video"
                  ? { uid: source }
                  : { communityId: source },
            ownerUserId: user.id,
          })
          .returning()

        feed = newFeed
        logger.info(`[Subscriptions] Auto-created ${adapterType} feed for ${source}`)
      }
    }

    if (!feed) return c.json({ code: 404, message: "Feed not found" }, 404)

    const existing = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, user.id), eq(subscriptions.feedId, feed.id)),
    })
    if (existing) return c.json({ code: 0, feed, list: null, unread: {} })

    await db.insert(subscriptions).values({
      id: generateSnowflakeId(),
      userId: user.id,
      feedId: feed.id,
      title: title ?? null,
      category: normalizeCategory(category) ?? null,
      view: resolveSubscriptionView(view, feed.adapterType),
      isPrivate: isPrivate ?? false,
      hideFromTimeline: hideFromTimeline ?? false,
    })

    await db
      .update(feeds)
      .set({ subscriptionCount: sql`COALESCE(${feeds.subscriptionCount}, 0) + 1` })
      .where(eq(feeds.id, feed.id))

    return c.json({ code: 0, feed, list: null, unread: {} })
  },
)

subscriptionsRouter.patch(
  "/",
  requireAuth,
  zValidator("json", updateSubscriptionSchema),
  async (c) => {
    const user = c.get("user")
    if (!user) return c.json({ code: 401, message: "Unauthorized" }, 401)

    const { feedId, ...updates } = c.req.valid("json")
    const [updated] = await updateUserFeedSubscriptions({
      userId: user.id,
      feedIds: [feedId],
      data: toUpdateData(updates),
    })

    if (!updated) return c.json({ code: 404, message: "Subscription not found" }, 404)
    return c.json({ code: 0, data: updated })
  },
)

subscriptionsRouter.patch(
  "/batch",
  requireAuth,
  zValidator("json", batchUpdateSubscriptionSchema),
  async (c) => {
    const user = c.get("user")
    if (!user) return c.json({ code: 401, message: "Unauthorized" }, 401)

    const { feedIds, ...updates } = c.req.valid("json")
    await updateUserFeedSubscriptions({
      userId: user.id,
      feedIds: [...new Set(feedIds)],
      data: toUpdateData(updates),
    })
    return c.json({ code: 0, data: null })
  },
)

subscriptionsRouter.delete(
  "/",
  requireAuth,
  zValidator("json", deleteSubscriptionSchema),
  async (c) => {
    const user = c.get("user")
    if (!user) return c.json({ code: 401, message: "Unauthorized" }, 401)

    const { feedIdList, feedId, url } = c.req.valid("json")
    const ids = new Set(feedIdList ?? [])
    if (feedId) ids.add(feedId)
    if (url) {
      const feed = await db.query.feeds.findFirst({ where: eq(feeds.url, url) })
      if (feed) ids.add(feed.id)
    }

    await deleteUserFeedSubscriptions(user.id, [...ids])
    return c.json({ code: 0, data: null })
  },
)

export default subscriptionsRouter
