/**
 * Entries Routes
 * Returns entries with feed data in the format expected by the client SDK (EntryWithFeed).
 */
import { and, desc, eq, inArray, lt } from "drizzle-orm"
import { Hono } from "hono"

import type { User } from "../auth/index.js"
import { db, feeds, posts, readStatus, subscriptions } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"

type EntriesVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const entriesRouter = new Hono<{ Variables: EntriesVariables }>()

/**
 * Transform a post + feed row into the EntryWithFeed shape expected by apiMorph.toEntryList.
 */
function toEntryWithFeed(
  post: typeof posts.$inferSelect,
  feed: typeof feeds.$inferSelect | null,
  read = false,
) {
  return {
    read,
    view: feed?.adapterType === "bilibili_up_video" ? 3 : 1, // Videos(3) for bilibili, Articles(1) otherwise
    from: [],
    feeds: {
      type: "feed" as const,
      id: feed?.id ?? post.feedId,
      url: feed?.url ?? "",
      title: feed?.title ?? "",
      description: feed?.description ?? "",
      siteUrl: feed?.siteUrl ?? "",
      image: feed?.image ?? "",
      errorAt: feed?.errorAt?.toISOString() ?? null,
      errorMessage: feed?.errorMessage ?? null,
      ownerUserId: feed?.ownerUserId ?? null,
    },
    entries: {
      id: post.id,
      title: post.title,
      url: post.url,
      description: post.description,
      guid: post.guid,
      author: post.author,
      authorUrl: post.authorUrl,
      authorAvatar: post.authorAvatar,
      insertedAt: post.insertedAt.toISOString(),
      publishedAt: post.publishedAt?.toISOString() ?? post.insertedAt.toISOString(),
      media: post.media ?? null,
      categories: post.categories ?? null,
      attachments: post.attachments ?? null,
      extra: post.extra ?? null,
      language: post.language,
      content: post.content,
    },
  }
}

/**
 * POST /entries
 * Returns entries for the user's subscribed feeds, matching EntryListResponse shape.
 */
entriesRouter.post("/", requireAuth, async (c) => {
  const user = c.get("user")
  if (!user) {
    return c.json({ code: 0, data: [] })
  }

  const body = await c.req.json().catch(() => ({}))
  const {
    feedId,
    feedIdList,
    limit = 50,
    publishedAfter,
    publishedBefore,
  } = body as {
    feedId?: string
    feedIdList?: string[]
    limit?: number
    publishedAfter?: string
    publishedBefore?: string
  }

  // Build the set of feed IDs to query
  let targetFeedIds: string[] = []

  if (feedId) {
    targetFeedIds = [feedId]
  } else if (feedIdList && feedIdList.length > 0) {
    targetFeedIds = feedIdList
  } else {
    // Get all subscribed feed IDs for the user
    const userSubs = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, user.id),
      columns: { feedId: true },
    })
    targetFeedIds = userSubs.map((s) => s.feedId)
  }

  if (targetFeedIds.length === 0) {
    return c.json({ code: 0, data: [] })
  }

  // Build where conditions
  const conditions = [inArray(posts.feedId, targetFeedIds)]

  if (publishedAfter) {
    // publishedAfter is a cursor: fetch entries older than this timestamp (next page in DESC order)
    conditions.push(lt(posts.publishedAt, new Date(publishedAfter)))
  }
  if (publishedBefore) {
    conditions.push(lt(posts.publishedAt, new Date(publishedBefore)))
  }

  // Fetch posts with their feeds and read status
  const postRows = await db
    .select({
      posts,
      feeds,
      readStatusId: readStatus.id,
    })
    .from(posts)
    .leftJoin(feeds, eq(posts.feedId, feeds.id))
    .leftJoin(readStatus, and(eq(readStatus.postId, posts.id), eq(readStatus.userId, user.id)))
    .where(and(...conditions))
    .orderBy(desc(posts.publishedAt))
    .limit(Math.min(limit, 100))

  const data = postRows.map((row) => toEntryWithFeed(row.posts, row.feeds, !!row.readStatusId))

  return c.json({ code: 0, data })
})

/**
 * GET /entries
 * Get a single entry by ID.
 */
entriesRouter.get("/", requireAuth, async (c) => {
  const id = c.req.query("id")
  if (!id) {
    return c.json({ code: 404, data: null }, 404)
  }

  const user = c.get("user")

  const [row] = await db
    .select({
      posts,
      feeds,
      readStatusId: readStatus.id,
    })
    .from(posts)
    .leftJoin(feeds, eq(posts.feedId, feeds.id))
    .leftJoin(
      readStatus,
      and(eq(readStatus.postId, posts.id), user ? eq(readStatus.userId, user.id) : undefined),
    )
    .where(eq(posts.id, id))
    .limit(1)

  if (!row) {
    return c.json({ code: 404, data: null }, 404)
  }

  const isRead = !!row.readStatusId
  const feed = row.feeds
  return c.json({
    code: 0,
    data: {
      read: isRead,
      feeds: {
        type: "feed" as const,
        id: feed?.id ?? row.posts.feedId,
        url: feed?.url ?? "",
        title: feed?.title ?? "",
        description: feed?.description ?? "",
        siteUrl: feed?.siteUrl ?? "",
        image: feed?.image ?? "",
        errorAt: feed?.errorAt?.toISOString() ?? null,
        errorMessage: feed?.errorMessage ?? null,
        ownerUserId: feed?.ownerUserId ?? null,
      },
      entries: {
        id: row.posts.id,
        title: row.posts.title,
        url: row.posts.url,
        description: row.posts.description,
        guid: row.posts.guid,
        author: row.posts.author,
        authorUrl: row.posts.authorUrl,
        authorAvatar: row.posts.authorAvatar,
        insertedAt: row.posts.insertedAt.toISOString(),
        publishedAt: row.posts.publishedAt?.toISOString() ?? row.posts.insertedAt.toISOString(),
        media: row.posts.media ?? null,
        categories: row.posts.categories ?? null,
        attachments: row.posts.attachments ?? null,
        extra: row.posts.extra ?? null,
        language: row.posts.language,
        content: row.posts.content,
      },
    },
  })
})

export default entriesRouter
