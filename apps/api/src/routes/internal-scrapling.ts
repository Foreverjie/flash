// apps/api/src/routes/internal-scrapling.ts
import { zValidator } from "@hono/zod-validator"
import { and, eq, gt, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { db, feeds, posts } from "../db/index.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"
import { sendNotFound, structuredSuccess } from "../utils/response.js"

const router = new Hono()

// Middleware: require internal API key
router.use("*", async (c, next) => {
  const key = c.req.header("x-internal-key")
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return c.json({ code: 401, message: "Unauthorized" }, 401)
  }
  return next()
})

const scrapedPostSchema = z.object({
  guid: z.string().min(1),
  title: z.string().max(200),
  url: z.string().url(),
  content: z.string(),
  published_at: z.string().datetime({ offset: true }),
  author: z.string(),
  media: z
    .array(z.object({ url: z.string(), type: z.enum(["image", "video", "audio"]) }))
    .default([]),
})

/**
 * GET /internal/scrapling/feeds
 * Returns scraper-backed feeds with at least one subscriber.
 * Used by the Python service to know which accounts to scrape.
 */
router.get("/feeds", async (c) => {
  const activeFeeds = await db.query.feeds.findMany({
    where: and(
      gt(feeds.subscriptionCount, 0),
      sql`${feeds.adapterType} IN ('x_timeline', 'bilibili_up_video')`,
    ),
    columns: { id: true, url: true, adapterType: true },
  })

  const result = activeFeeds.map((f) => ({
    feedId: f.id,
    adapterType: f.adapterType,
    source:
      f.adapterType === "x_timeline"
        ? f.url.replace("x_timeline://", "")
        : f.url.replace("bilibili_up_video://", ""),
  }))

  return c.json(structuredSuccess(result))
})

/**
 * POST /internal/scrapling/ingest
 * Receives scraped posts from the Python service and inserts them.
 */
router.post(
  "/ingest",
  zValidator(
    "json",
    z.object({
      feedId: z.string().min(1),
      posts: z.array(scrapedPostSchema),
    }),
  ),
  async (c) => {
    const { feedId, posts: incomingPosts } = c.req.valid("json")

    // Verify feed exists and is a supported scraper-backed type
    const feed = await db.query.feeds.findFirst({
      where: and(
        eq(feeds.id, feedId),
        sql`${feeds.adapterType} IN ('x_timeline', 'bilibili_up_video')`,
      ),
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    let inserted = 0
    for (const item of incomingPosts) {
      const result = await db
        .insert(posts)
        .values({
          id: generateSnowflakeId(),
          feedId,
          guid: item.guid,
          title: item.title,
          url: item.url,
          content: item.content,
          author: item.author,
          publishedAt: new Date(item.published_at),
          media: item.media,
          scrapeStatus: "scraped", // already full content — skip readability queue
        })
        .onConflictDoNothing() // (feedId, guid) unique — silent dedup
        .returning({ id: posts.id })
      // Only count posts that were actually inserted (not conflict-skipped)
      if (result.length > 0) inserted++
    }

    await db
      .update(feeds)
      .set({ lastFetchedAt: new Date(), errorAt: null, errorMessage: null })
      .where(eq(feeds.id, feedId))

    logger.info("[Scrapling] Ingested posts for feed", { inserted, feedId })
    return c.json(structuredSuccess({ inserted }))
  },
)

export default router
