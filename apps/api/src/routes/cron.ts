/**
 * Cron Routes
 * Scheduled tasks invoked by Vercel Cron or external schedulers.
 *
 * Protected by a shared CRON_SECRET to prevent unauthorized access.
 */
import { Hono } from "hono"

import { syncAllFeeds } from "../lib/feed-sync.js"
import { enqueuePostsForScraping, getScrapeStats, processScrapeBatch } from "../lib/scrape-queue.js"
import { logger } from "../utils/logger.js"
import { sendError, structuredSuccess } from "../utils/response.js"

const cronRouter = new Hono()

/**
 * Middleware: verify CRON_SECRET header for cron endpoints.
 * Vercel automatically sends `Authorization: Bearer <CRON_SECRET>`.
 * For local/manual triggers, send the same header.
 */
cronRouter.use("*", async (c, next) => {
  const cronSecret = process.env.CRON_SECRET

  // Skip auth check in development if CRON_SECRET is not set
  if (!cronSecret) {
    logger.warn("[Cron] CRON_SECRET not set — allowing unauthenticated access (dev mode)")
    return next()
  }

  const authHeader = c.req.header("Authorization")
  const token = authHeader?.replace("Bearer ", "")

  if (token !== cronSecret) {
    logger.warn("[Cron] Unauthorized cron request")
    return sendError(c, "Unauthorized", 401, 401)
  }

  return next()
})

/**
 * GET /cron/sync-feeds
 * Fetch all RSS feeds and insert new posts.
 *
 * Query params:
 *   - concurrency: number of parallel fetches (default 5)
 *   - staleMinutes: only re-fetch feeds older than N minutes (default 0 = all)
 */
cronRouter.get("/sync-feeds", async (c) => {
  try {
    const concurrency = Number(c.req.query("concurrency")) || 5
    const staleMinutes = Number(c.req.query("staleMinutes")) || 0

    logger.info(
      `[Cron] sync-feeds triggered (concurrency=${concurrency}, staleMinutes=${staleMinutes})`,
    )

    const summary = await syncAllFeeds({ concurrency, staleMinutes })

    return c.json(
      structuredSuccess({
        message: "Feed sync completed",
        totalFeeds: summary.totalFeeds,
        successCount: summary.successCount,
        errorCount: summary.errorCount,
        newPostsTotal: summary.newPostsTotal,
        durationMs: summary.durationMs,
        // Include per-feed results for debugging
        results: summary.results.map((r) => ({
          feedId: r.feedId,
          title: r.feedTitle,
          success: r.success,
          newPosts: r.newPosts,
          error: r.error,
        })),
      }),
    )
  } catch (error) {
    logger.error("[Cron] sync-feeds failed:", error)
    return sendError(c, "Feed sync failed", 500, 500)
  }
})

/**
 * GET /cron/scrape-enqueue
 * PRODUCER: Scan posts missing full content and mark them for scraping.
 *
 * Query params:
 *   - limit: max posts to enqueue (default 100)
 */
cronRouter.get("/scrape-enqueue", async (c) => {
  try {
    const limit = Number(c.req.query("limit")) || 100

    logger.info(`[Cron] scrape-enqueue triggered (limit=${limit})`)

    const result = await enqueuePostsForScraping(limit)
    const stats = await getScrapeStats()

    return c.json(
      structuredSuccess({
        message: "Scrape enqueue completed",
        ...result,
        queueStats: stats,
      }),
    )
  } catch (error) {
    logger.error("[Cron] scrape-enqueue failed:", error)
    return sendError(c, "Scrape enqueue failed", 500, 500)
  }
})

/**
 * GET /cron/scrape-process
 * CONSUMER: Claim and process a batch of pending posts.
 *
 * Query params:
 *   - batchSize: posts to process per invocation (default 5)
 *   - concurrency: parallel scrapes (default 2)
 */
cronRouter.get("/scrape-process", async (c) => {
  try {
    const batchSize = Number(c.req.query("batchSize")) || 5
    const concurrency = Number(c.req.query("concurrency")) || 2

    logger.info(
      `[Cron] scrape-process triggered (batchSize=${batchSize}, concurrency=${concurrency})`,
    )

    const result = await processScrapeBatch(batchSize, concurrency)
    const stats = await getScrapeStats()

    return c.json(
      structuredSuccess({
        message: "Scrape batch processed",
        ...result,
        queueStats: stats,
      }),
    )
  } catch (error) {
    logger.error("[Cron] scrape-process failed:", error)
    return sendError(c, "Scrape processing failed", 500, 500)
  }
})

/**
 * GET /cron/scrape-stats
 * Returns current scrape queue statistics. Useful for monitoring dashboards.
 */
cronRouter.get("/scrape-stats", async (c) => {
  try {
    const stats = await getScrapeStats()
    return c.json(structuredSuccess(stats))
  } catch (error) {
    logger.error("[Cron] scrape-stats failed:", error)
    return sendError(c, "Failed to get scrape stats", 500, 500)
  }
})

/**
 * GET /cron/sync-all
 * Combined daily job for Vercel Hobby (1 cron/day limit).
 * Runs the full pipeline sequentially: sync feeds → enqueue → process scrape batches.
 *
 * Vercel Hobby has a 10s function timeout, so we keep scrape batches small.
 * For heavier workloads, call the individual endpoints manually or upgrade.
 */
cronRouter.get("/sync-all", async (c) => {
  const startTime = Date.now()
  const phases: Record<string, unknown> = {}

  try {
    // Phase 1: Sync RSS feeds
    logger.info("[Cron] sync-all — Phase 1: Syncing feeds")
    const feedSummary = await syncAllFeeds({ concurrency: 3 })
    phases.feedSync = {
      totalFeeds: feedSummary.totalFeeds,
      successCount: feedSummary.successCount,
      errorCount: feedSummary.errorCount,
      newPostsTotal: feedSummary.newPostsTotal,
      durationMs: feedSummary.durationMs,
    }

    // Phase 2: Enqueue posts that need scraping
    logger.info("[Cron] sync-all — Phase 2: Enqueueing posts for scraping")
    const enqueueResult = await enqueuePostsForScraping(50)
    phases.scrapeEnqueue = enqueueResult

    // Phase 3: Process a small scrape batch (keep within timeout)
    logger.info("[Cron] sync-all — Phase 3: Processing scrape batch")
    const scrapeResult = await processScrapeBatch(3, 2)
    phases.scrapeProcess = {
      processed: scrapeResult.processed,
      succeeded: scrapeResult.succeeded,
      failed: scrapeResult.failed,
      durationMs: scrapeResult.durationMs,
    }

    const stats = await getScrapeStats()
    const totalDuration = Date.now() - startTime

    logger.info(`[Cron] sync-all completed in ${totalDuration}ms`)

    return c.json(
      structuredSuccess({
        message: "Daily sync completed",
        durationMs: totalDuration,
        phases,
        queueStats: stats,
      }),
    )
  } catch (error) {
    logger.error("[Cron] sync-all failed:", error)
    return sendError(c, "Daily sync failed", 500, 500)
  }
})

export default cronRouter
