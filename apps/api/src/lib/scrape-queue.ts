/**
 * Scrape Queue — DB-backed Producer/Consumer
 *
 * Uses the `scrape_status` column on posts as a lightweight queue.
 * This avoids external dependencies (Redis, Inngest) while fitting within
 * Vercel Serverless timeout limits by processing small batches per invocation.
 *
 * Statuses: pending → processing → scraped | failed
 *
 * Producer (enqueue): Marks posts that need scraping (have a URL but no formattedContent).
 * Consumer (process): Claims a batch, scrapes each, updates the DB.
 */
import { and, eq, isNull, lt, or, sql } from "drizzle-orm"

import { db, posts } from "../db/index.js"
import { logger } from "../utils/logger.js"
import { scrapeWithRetry } from "./scraper.js"

const MAX_ATTEMPTS = 3

export interface EnqueueResult {
  enqueued: number
  alreadyQueued: number
}

export interface ProcessResult {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  results: Array<{
    postId: string
    title: string | null
    url: string | null
    success: boolean
    attempts: number
    error?: string
  }>
  durationMs: number
}

/**
 * PRODUCER: Find posts missing full content and mark them as "pending" for scraping.
 *
 * Targets posts where:
 *  - url is NOT null (we need a URL to scrape)
 *  - formattedContent is null OR formattedContent.html is empty
 *  - scrapeStatus is null (never queued) or stuck in "processing" for >10 minutes
 *
 * @param limit Max number of posts to enqueue per invocation
 */
export async function enqueuePostsForScraping(limit = 100): Promise<EnqueueResult> {
  const stuckThreshold = new Date(Date.now() - 10 * 60 * 1000) // 10 min ago

  // Find posts that need scraping
  const candidates = await db
    .select({ id: posts.id, scrapeStatus: posts.scrapeStatus })
    .from(posts)
    .where(
      and(
        // Must have a URL
        sql`${posts.url} IS NOT NULL`,
        // Must be missing content
        or(isNull(posts.formattedContent), sql`${posts.formattedContent}::text = '{}'`),
        // Not already scraped/failed beyond max attempts
        or(
          // Never queued
          isNull(posts.scrapeStatus),
          // Stuck in processing (timeout recovery)
          and(eq(posts.scrapeStatus, "processing"), lt(posts.updatedAt, stuckThreshold)),
        ),
        // Haven't exceeded max attempts
        or(isNull(posts.scrapeAttempts), lt(posts.scrapeAttempts, MAX_ATTEMPTS)),
      ),
    )
    .limit(limit)

  if (candidates.length === 0) {
    logger.info("[ScrapeQueue] No posts need scraping")
    return { enqueued: 0, alreadyQueued: 0 }
  }

  const ids = candidates.map((p) => p.id)
  const alreadyQueued = candidates.filter((p) => p.scrapeStatus === "pending").length

  // Mark all as pending
  await db
    .update(posts)
    .set({ scrapeStatus: "pending", updatedAt: new Date() })
    .where(sql`${posts.id} IN ${ids}`)

  logger.info(
    `[ScrapeQueue] Enqueued ${ids.length} posts for scraping (${alreadyQueued} were re-queued)`,
  )

  return { enqueued: ids.length, alreadyQueued }
}

/**
 * CONSUMER: Claim and process a batch of pending posts.
 *
 * Uses an atomic UPDATE ... RETURNING to "claim" posts (set status to "processing"),
 * then scrapes each one with concurrency control.
 *
 * @param batchSize Number of posts to process in this invocation (default 5)
 * @param concurrency Max concurrent scrapes (default 2)
 */
export async function processScrapeBatch(batchSize = 5, concurrency = 2): Promise<ProcessResult> {
  const startTime = Date.now()
  const result: ProcessResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: [],
    durationMs: 0,
  }

  // Atomically claim a batch of pending posts
  const claimed = await db
    .update(posts)
    .set({ scrapeStatus: "processing", updatedAt: new Date() })
    .where(
      sql`${posts.id} IN (
        SELECT ${posts.id} FROM ${posts}
        WHERE ${posts.scrapeStatus} = 'pending'
        AND ${posts.url} IS NOT NULL
        ORDER BY ${posts.publishedAt} DESC NULLS LAST
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )`,
    )
    .returning({
      id: posts.id,
      url: posts.url,
      title: posts.title,
      content: posts.content,
      description: posts.description,
      scrapeAttempts: posts.scrapeAttempts,
    })

  if (claimed.length === 0) {
    logger.info("[ScrapeQueue] No pending posts to process")
    result.durationMs = Date.now() - startTime
    return result
  }

  logger.info(`[ScrapeQueue] Claimed ${claimed.length} posts for processing`)

  // Process in concurrent batches
  for (let i = 0; i < claimed.length; i += concurrency) {
    const batch = claimed.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (post) => {
        if (!post.url) {
          result.skipped++
          return {
            postId: post.id,
            title: post.title,
            url: post.url,
            success: false,
            attempts: 0,
            error: "No URL",
          }
        }

        // If the post already has decent content from RSS, skip scraping
        if (post.content && post.content.length > 500) {
          await db
            .update(posts)
            .set({
              scrapeStatus: "scraped",
              formattedContent: {
                html: post.content,
                text: stripHtmlBasic(post.content),
              },
              scrapedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(posts.id, post.id))

          result.succeeded++
          result.processed++
          return { postId: post.id, title: post.title, url: post.url, success: true, attempts: 0 }
        }

        try {
          const scrapeResult = await scrapeWithRetry(
            post.url,
            MAX_ATTEMPTS - (post.scrapeAttempts ?? 0),
          )

          if (scrapeResult.success && scrapeResult.content) {
            await db
              .update(posts)
              .set({
                scrapeStatus: "scraped",
                formattedContent: {
                  html: scrapeResult.content,
                  text: scrapeResult.textContent,
                },
                scrapeAttempts: (post.scrapeAttempts ?? 0) + scrapeResult.attempts,
                scrapeError: null,
                scrapedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(posts.id, post.id))

            result.succeeded++
            logger.info(`[ScrapeQueue] ✅ Scraped: ${post.title || post.url}`)
          } else {
            const totalAttempts = (post.scrapeAttempts ?? 0) + scrapeResult.attempts
            const isFinal = totalAttempts >= MAX_ATTEMPTS

            await db
              .update(posts)
              .set({
                scrapeStatus: isFinal ? "failed" : "pending",
                scrapeAttempts: totalAttempts,
                scrapeError: scrapeResult.error ?? "Unknown error",
                updatedAt: new Date(),
              })
              .where(eq(posts.id, post.id))

            result.failed++
            logger.warn(
              `[ScrapeQueue] ❌ Failed: ${post.title || post.url} — ${scrapeResult.error} (attempt ${totalAttempts}/${MAX_ATTEMPTS})`,
            )
          }

          result.processed++
          return {
            postId: post.id,
            title: post.title,
            url: post.url,
            success: scrapeResult.success,
            attempts: scrapeResult.attempts,
            error: scrapeResult.error,
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error)

          await db
            .update(posts)
            .set({
              scrapeStatus: "failed",
              scrapeError: errMsg,
              scrapeAttempts: (post.scrapeAttempts ?? 0) + 1,
              updatedAt: new Date(),
            })
            .where(eq(posts.id, post.id))

          result.failed++
          result.processed++
          return {
            postId: post.id,
            title: post.title,
            url: post.url,
            success: false,
            attempts: 1,
            error: errMsg,
          }
        }
      }),
    )

    result.results.push(...batchResults)
  }

  result.durationMs = Date.now() - startTime

  logger.info(
    `[ScrapeQueue] Batch done — ${result.succeeded}/${result.processed} succeeded, ${result.failed} failed, ${result.durationMs}ms`,
  )

  return result
}

/**
 * Get scrape queue statistics
 */
export async function getScrapeStats(): Promise<{
  pending: number
  processing: number
  scraped: number
  failed: number
  unqueued: number
}> {
  const [stats] = await db
    .select({
      pending: sql<number>`count(*) FILTER (WHERE ${posts.scrapeStatus} = 'pending')::int`,
      processing: sql<number>`count(*) FILTER (WHERE ${posts.scrapeStatus} = 'processing')::int`,
      scraped: sql<number>`count(*) FILTER (WHERE ${posts.scrapeStatus} = 'scraped')::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${posts.scrapeStatus} = 'failed')::int`,
      unqueued: sql<number>`count(*) FILTER (WHERE ${posts.scrapeStatus} IS NULL)::int`,
    })
    .from(posts)

  return stats!
}

function stripHtmlBasic(html: string): string {
  return html
    .replaceAll(/<[^>]*>/g, "")
    .replaceAll(/\s+/g, " ")
    .trim()
}
