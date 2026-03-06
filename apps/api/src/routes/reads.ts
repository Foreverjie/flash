/**
 * Reads Routes
 * Manages read/unread status for entries (posts).
 */
import { and, count, eq, inArray, lt, notInArray } from "drizzle-orm"
import { Hono } from "hono"

import type { User } from "../auth/index.js"
import { db, posts, readStatus, subscriptions } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"
import { generateSnowflakeId } from "../utils/id.js"

type ReadsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const readsRouter = new Hono<{ Variables: ReadsVariables }>()

/**
 * GET /
 * Return unread counts per feed: Record<feedId, number>
 */
readsRouter.get("/", requireAuth, async (c) => {
  const user = c.get("user")!

  // Get user's subscribed feed IDs
  const userSubs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, user.id),
    columns: { feedId: true },
  })

  const feedIds = userSubs.map((s) => s.feedId)
  if (feedIds.length === 0) {
    return c.json({ code: 0, data: {} })
  }

  // For each feed, count posts that have NO read_status row for this user
  const rows = await db
    .select({
      feedId: posts.feedId,
      unreadCount: count(posts.id),
    })
    .from(posts)
    .where(
      and(
        inArray(posts.feedId, feedIds),
        notInArray(
          posts.id,
          db
            .select({ postId: readStatus.postId })
            .from(readStatus)
            .where(eq(readStatus.userId, user.id)),
        ),
      ),
    )
    .groupBy(posts.feedId)

  const data: Record<string, number> = {}
  for (const row of rows) {
    data[row.feedId] = row.unreadCount
  }

  return c.json({ code: 0, data })
})

/**
 * POST /
 * Mark specific entries as read by entryIds.
 */
readsRouter.post("/", requireAuth, async (c) => {
  const user = c.get("user")!
  const body = await c.req.json().catch(() => ({}))
  const { entryIds } = body as { entryIds?: string[] }

  if (!entryIds || entryIds.length === 0) {
    return c.json({ code: 0, data: null })
  }

  const values = entryIds.map((postId) => ({
    id: generateSnowflakeId(),
    userId: user.id,
    postId,
  }))

  await db
    .insert(readStatus)
    .values(values)
    .onConflictDoNothing({ target: [readStatus.userId, readStatus.postId] })

  return c.json({ code: 0, data: null })
})

/**
 * DELETE /
 * Mark single entry as unread by entryId.
 */
readsRouter.delete("/", requireAuth, async (c) => {
  const user = c.get("user")!
  const body = await c.req.json().catch(() => ({}))
  const { entryId } = body as { entryId?: string }

  if (!entryId) {
    return c.json({ code: 0, data: null })
  }

  await db
    .delete(readStatus)
    .where(and(eq(readStatus.userId, user.id), eq(readStatus.postId, entryId)))

  return c.json({ code: 0, data: null })
})

/**
 * POST /all
 * Batch mark-all-as-read by feed/view/list/time filters.
 */
readsRouter.post("/all", requireAuth, async (c) => {
  const user = c.get("user")!
  const body = await c.req.json().catch(() => ({}))
  const { feedId, feedIdList, insertedBefore } = body as {
    feedId?: string
    feedIdList?: string[]
    listId?: string
    startTime?: string
    endTime?: string
    excludePrivate?: boolean
    insertedBefore?: string
  }

  // Determine target feeds
  let targetFeedIds: string[] = []

  if (feedId) {
    targetFeedIds = [feedId]
  } else if (feedIdList && feedIdList.length > 0) {
    targetFeedIds = feedIdList
  } else {
    // All subscribed feeds
    const userSubs = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, user.id),
      columns: { feedId: true },
    })
    targetFeedIds = userSubs.map((s) => s.feedId)
  }

  if (targetFeedIds.length === 0) {
    return c.json({ code: 0, data: { read: {} } })
  }

  // Find all unread posts for these feeds
  const conditions = [
    inArray(posts.feedId, targetFeedIds),
    notInArray(
      posts.id,
      db
        .select({ postId: readStatus.postId })
        .from(readStatus)
        .where(eq(readStatus.userId, user.id)),
    ),
  ]

  if (insertedBefore) {
    conditions.push(lt(posts.insertedAt, new Date(insertedBefore)))
  }

  const unreadPosts = await db
    .select({ id: posts.id, feedId: posts.feedId })
    .from(posts)
    .where(and(...conditions))

  if (unreadPosts.length === 0) {
    return c.json({ code: 0, data: { read: {} } })
  }

  // Insert read_status rows
  const values = unreadPosts.map((post) => ({
    id: generateSnowflakeId(),
    userId: user.id,
    postId: post.id,
  }))

  await db
    .insert(readStatus)
    .values(values)
    .onConflictDoNothing({ target: [readStatus.userId, readStatus.postId] })

  // Count per feed
  const readCounts: Record<string, number> = {}
  for (const post of unreadPosts) {
    readCounts[post.feedId] = (readCounts[post.feedId] || 0) + 1
  }

  return c.json({ code: 0, data: { read: readCounts } })
})

/**
 * GET /total-count
 * Return total unread count across all subscribed feeds.
 */
readsRouter.get("/total-count", requireAuth, async (c) => {
  const user = c.get("user")!

  const userSubs = await db.query.subscriptions.findMany({
    where: eq(subscriptions.userId, user.id),
    columns: { feedId: true },
  })

  const feedIds = userSubs.map((s) => s.feedId)
  if (feedIds.length === 0) {
    return c.json({ code: 0, data: { count: 0 } })
  }

  const [result] = await db
    .select({ unreadCount: count(posts.id) })
    .from(posts)
    .where(
      and(
        inArray(posts.feedId, feedIds),
        notInArray(
          posts.id,
          db
            .select({ postId: readStatus.postId })
            .from(readStatus)
            .where(eq(readStatus.userId, user.id)),
        ),
      ),
    )

  return c.json({ code: 0, data: { count: result?.unreadCount ?? 0 } })
})

export default readsRouter
