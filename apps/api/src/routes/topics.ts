/**
 * Topics Routes
 * Curated topics used by onboarding/discover to recommend feeds.
 */
import { zValidator } from "@hono/zod-validator"
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { db, feeds, feedTopics, subscriptions, topics, users } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"

type TopicsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const topicsRouter = new Hono<{ Variables: TopicsVariables }>()

/**
 * GET /topics
 * List curated topics, ordered by sort_order then label.
 */
topicsRouter.get("/", async (c) => {
  const rows = await db.select().from(topics).orderBy(topics.sortOrder, topics.label)
  return c.json({ code: 0, data: rows })
})

/**
 * GET /topics/:slug/feeds
 * List feeds curated for a single topic, ordered by subscription count desc.
 */
topicsRouter.get("/:slug/feeds", async (c) => {
  const slug = c.req.param("slug")
  const topic = await db.query.topics.findFirst({ where: eq(topics.slug, slug) })
  if (!topic) {
    return c.json({ code: 404, message: "Topic not found" }, 404)
  }

  const rows = await db
    .select({ feed: feeds })
    .from(feedTopics)
    .innerJoin(feeds, eq(feeds.id, feedTopics.feedId))
    .where(eq(feedTopics.topicId, topic.id))
    .orderBy(desc(feeds.subscriptionCount))

  return c.json({ code: 0, data: rows.map((r) => r.feed) })
})

/**
 * POST /onboarding/subscribe
 * Bulk-subscribe authenticated user to a list of feedIds. Idempotent.
 * Body: { feedIds: string[], topicSlugs?: string[] }
 *   - feedIds: explicit feeds to subscribe to.
 *   - topicSlugs: optional fallback. If no explicit feedIds are sent, fan out
 *     and subscribe to all feeds curated for those topics.
 */
const subscribeSchema = z.object({
  feedIds: z.array(z.string()).default([]),
  topicSlugs: z.array(z.string()).default([]),
})

topicsRouter.post(
  "/onboarding/subscribe",
  requireAuth,
  zValidator("json", subscribeSchema),
  async (c) => {
    const user = c.get("user")
    if (!user) {
      return c.json({ code: 401, message: "Unauthorized" }, 401)
    }

    const { feedIds, topicSlugs } = c.req.valid("json")

    // Reaching this endpoint means the user finished the onboarding flow, even
    // if they skipped every topic/feed. Stamp completion once and keep the
    // original timestamp on any repeat call.
    await db
      .update(users)
      .set({ onboardedAt: new Date() })
      .where(and(eq(users.id, user.id), isNull(users.onboardedAt)))

    // Resolve topic slugs to feed ids only as a fallback. When feedIds are
    // present, they represent the user's final curated choices.
    const expandedIds = new Set<string>(feedIds)
    if (expandedIds.size === 0 && topicSlugs.length > 0) {
      const matchedTopics = await db
        .select({ id: topics.id })
        .from(topics)
        .where(inArray(topics.slug, topicSlugs))
      const topicIds = matchedTopics.map((t) => t.id)
      if (topicIds.length > 0) {
        const rows = await db
          .select({ feedId: feedTopics.feedId })
          .from(feedTopics)
          .where(inArray(feedTopics.topicId, topicIds))
        for (const row of rows) expandedIds.add(row.feedId)
      }
    }

    if (expandedIds.size === 0) {
      return c.json({ code: 0, data: { subscribed: 0 } })
    }

    const ids = [...expandedIds]

    // Filter to feeds that actually exist
    const existing = await db.select({ id: feeds.id }).from(feeds).where(inArray(feeds.id, ids))
    const validIds = existing.map((f) => f.id)
    if (validIds.length === 0) {
      return c.json({ code: 0, data: { subscribed: 0 } })
    }

    // Find which the user is already subscribed to
    const alreadySubbed = await db
      .select({ feedId: subscriptions.feedId })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), inArray(subscriptions.feedId, validIds)))
    const alreadySet = new Set(alreadySubbed.map((s) => s.feedId))

    const toInsert = validIds
      .filter((id) => !alreadySet.has(id))
      .map((feedId) => ({
        id: generateSnowflakeId(),
        userId: user.id,
        feedId,
        title: null,
        category: null,
        isPrivate: false,
      }))

    if (toInsert.length > 0) {
      await db.insert(subscriptions).values(toInsert).onConflictDoNothing()

      // Bump subscription_count for each feed
      await db
        .update(feeds)
        .set({
          subscriptionCount: sql`COALESCE(${feeds.subscriptionCount}, 0) + 1`,
        })
        .where(
          inArray(
            feeds.id,
            toInsert.map((s) => s.feedId),
          ),
        )

      logger.info(
        `[Onboarding] User ${user.id} subscribed to ${toInsert.length} feeds (skipped ${alreadySet.size} duplicates)`,
      )
    }

    return c.json({
      code: 0,
      data: { subscribed: toInsert.length, alreadySubscribed: alreadySet.size },
    })
  },
)

export default topicsRouter
