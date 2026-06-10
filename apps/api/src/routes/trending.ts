/**
 * Trending Routes
 * Ranks feeds for the Discover surface. Shape matches the client SDK's
 * trending module (GET /trending/feeds -> TrendingFeedItem[]).
 */
import { zValidator } from "@hono/zod-validator"
import type { SQL } from "drizzle-orm"
import { desc, gte, inArray, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { db, feeds, posts } from "../db/index.js"
import { structuredSuccess } from "../utils/response.js"

const trendingRouter = new Hono()

/** SDK language codes -> feed.language prefixes stored in the DB. */
const LANGUAGE_PREFIXES: Record<string, string[]> = {
  eng: ["en"],
  cmn: ["zh"],
}

const trendingQuerySchema = z.object({
  language: z.enum(["eng", "cmn"]).optional(),
  view: z.coerce.number().optional(),
  range: z.enum(["1d", "3d", "7d", "30d"]).optional(),
  limit: z.coerce.number().positive().max(50).default(20),
})

/**
 * GET /trending/feeds
 * Most-subscribed feeds, optionally filtered by language. `range` narrows to
 * feeds that published within the window so stale feeds don't trend forever.
 */
trendingRouter.get("/feeds", zValidator("query", trendingQuerySchema), async (c) => {
  const { language, range, limit } = c.req.valid("query")

  const conditions: SQL[] = []

  if (language) {
    const prefixes = LANGUAGE_PREFIXES[language] ?? []
    if (prefixes.length > 0) {
      conditions.push(
        sql`(${sql.join(
          prefixes.map((p) => sql`${feeds.language} ILIKE ${`${p}%`}`),
          sql` OR `,
        )})`,
      )
    }
  }

  if (range) {
    const days = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 }[range]
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const activeFeedIds = db
      .selectDistinct({ feedId: posts.feedId })
      .from(posts)
      .where(gte(posts.publishedAt, since))
    conditions.push(inArray(feeds.id, activeFeedIds))
  }

  const rows = await db
    .select()
    .from(feeds)
    .where(conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined)
    .orderBy(desc(feeds.subscriptionCount), desc(feeds.updatedAt))
    .limit(limit)

  const data = rows.map((feed) => ({
    feedId: feed.id,
    view: null,
    feed,
    analytics: {
      feedId: feed.id,
      subscriptionCount: feed.subscriptionCount ?? 0,
      updatesPerWeek: feed.updatesPerWeek,
      view: null,
    },
  }))

  return c.json(structuredSuccess(data))
})

export default trendingRouter
