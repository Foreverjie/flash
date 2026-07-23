// apps/api/src/routes/internal-scrapling.ts
import { zValidator } from "@hono/zod-validator"
import { and, desc, eq, gt, inArray } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { db, feeds, posts } from "../db/index.js"
import { SCRAPLING_ADAPTER_TYPES } from "../lib/scraping-client.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"
import { sendError, sendNotFound, structuredSuccess } from "../utils/response.js"

const router = new Hono()

// Middleware: require internal API key
router.use("*", async (c, next) => {
  const key = c.req.header("x-internal-key")
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return c.json({ code: 401, message: "Unauthorized" }, 401)
  }
  return next()
})

// Community (real-estate) adapters must attach structured listing data.
const COMMUNITY_ADAPTER_TYPES = ["leyoujia_community", "qfang_community"] as const

const propertySchema = z.object({
  community: z.string(),
  title: z.string().default(""),
  city: z.string().default(""),
  hood: z.string().default(""),
  beds: z.number().default(0),
  halls: z.number().default(0),
  baths: z.number().default(0),
  area: z.number().default(0),
  total: z.string().default(""),
  total_num: z.number().default(0),
  unit: z.string().default(""),
  unit_num: z.number().default(0),
  floor: z.string().default(""),
  orientation: z.string().default(""),
  reno: z.string().default(""),
  tags: z.array(z.string()).default([]),
  badge: z.enum(["new", "reduced", ""]).default(""),
  reduced_by: z.string().default(""),
  orig: z.string().default(""),
  sold: z.boolean().default(false),
  image: z.string().default(""),
})

const scrapedPostSchema = z.object({
  guid: z.string().min(1),
  title: z.string().max(200),
  url: z.string().url(),
  content: z.string(),
  published_at: z.string().datetime({ offset: true }),
  author: z.string(),
  media: z
    .array(z.object({ url: z.string(), type: z.enum(["photo", "video", "audio"]) }))
    .default([]),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        mime_type: z.string().optional(),
        duration_in_seconds: z.number().optional(),
        size_in_bytes: z.number().optional(),
        title: z.string().optional(),
      }),
    )
    .default([]),
  // Present for community listing feeds; null for other adapters.
  property: propertySchema.nullish(),
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
      inArray(feeds.adapterType, [...SCRAPLING_ADAPTER_TYPES]),
    ),
    columns: { id: true, url: true, adapterType: true },
  })

  const result = activeFeeds.map((f) => ({
    feedId: f.id,
    adapterType: f.adapterType,
    source: f.url.replace(`${f.adapterType}://`, ""),
  }))

  return c.json(structuredSuccess(result))
})

/**
 * GET /internal/scrapling/feeds/:feedId/guids
 * Existing post guids for a feed, newest first. Used by adapters that diff
 * against already-ingested posts (e.g. community listings labeling price changes).
 */
router.get(
  "/feeds/:feedId/guids",
  zValidator("param", z.object({ feedId: z.string().min(1) })),
  async (c) => {
    const { feedId } = c.req.valid("param")

    const feed = await db.query.feeds.findFirst({
      where: and(eq(feeds.id, feedId), inArray(feeds.adapterType, [...SCRAPLING_ADAPTER_TYPES])),
      columns: { id: true },
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    const feedPosts = await db.query.posts.findMany({
      where: eq(posts.feedId, feedId),
      columns: { guid: true },
      orderBy: [desc(posts.publishedAt)],
      limit: 5000,
    })

    return c.json(structuredSuccess({ guids: feedPosts.map((p) => p.guid) }))
  },
)

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
      where: and(eq(feeds.id, feedId), inArray(feeds.adapterType, [...SCRAPLING_ADAPTER_TYPES])),
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    // Structured `property` is mandatory for community listing feeds.
    const isCommunityFeed = (COMMUNITY_ADAPTER_TYPES as readonly string[]).includes(
      feed.adapterType ?? "",
    )
    if (isCommunityFeed) {
      const missing = incomingPosts.find((p) => !p.property)
      if (missing) {
        return sendError(
          c,
          `Missing required "property" field for community listing ${missing.guid}`,
          400,
          400,
        )
      }
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
          attachments: item.attachments.length > 0 ? item.attachments : undefined,
          property: item.property ?? undefined,
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
