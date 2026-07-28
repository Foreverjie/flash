/**
 * Feed Sync Service
 *
 * Fetches all RSS feeds from the database and inserts new posts.
 * Designed to be called from a cron job or manually via CLI.
 */
import { and, eq, inArray, isNull, lt, not, or } from "drizzle-orm"

import { db, feeds, posts } from "../db/index.js"
import { rssManager } from "../lib/rss/index.js"
import { isScraplingAdapterType, SCRAPLING_ADAPTER_TYPES } from "../lib/scraping-client.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"

export interface SyncResult {
  feedId: string
  feedTitle: string | null
  url: string
  success: boolean
  newPosts: number
  error?: string
  /** Scraper-backed feed — not fetched here; the Python scraper owns it. */
  skipped?: boolean
}

export interface SyncSummary {
  totalFeeds: number
  successCount: number
  errorCount: number
  skippedCount: number
  newPostsTotal: number
  results: SyncResult[]
  durationMs: number
}

/**
 * Sync a single feed: fetch RSS, insert new posts, update feed metadata.
 */
async function syncFeed(feed: typeof feeds.$inferSelect): Promise<SyncResult> {
  const result: SyncResult = {
    feedId: feed.id,
    feedTitle: feed.title,
    url: feed.url,
    success: false,
    newPosts: 0,
  }

  // Scraper-backed feeds have custom-scheme URLs (`leyoujia_community://850254`)
  // that the RSS fetcher cannot resolve a host from — it falls back to
  // localhost:80 and stamps a bogus ECONNREFUSED on the feed, masking the real
  // scraper state. They are refreshed by the Python scraper, not from here.
  if (isScraplingAdapterType(feed.adapterType)) {
    result.success = true
    result.skipped = true
    return result
  }

  try {
    const fetchResult = await rssManager.fetch(feed.url)

    if (!fetchResult.success || !fetchResult.data) {
      result.error = fetchResult.error || "Failed to fetch feed"

      // Record error in the feed row
      await db
        .update(feeds)
        .set({
          errorAt: new Date(),
          errorMessage: result.error,
          updatedAt: new Date(),
        })
        .where(eq(feeds.id, feed.id))

      return result
    }

    const feedData = fetchResult.data

    // Update feed metadata
    await db
      .update(feeds)
      .set({
        title: feedData.title || feed.title,
        description: feedData.description || feed.description,
        siteUrl: feedData.siteUrl || feed.siteUrl,
        image: feedData.image || feed.image,
        language: feedData.language || feed.language,
        lastFetchedAt: new Date(),
        lastBuildDate: feedData.lastBuildDate,
        errorAt: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, feed.id))

    // Insert new posts in batches (skip duplicates via unique constraint)
    if (feedData.items.length > 0) {
      const postsToInsert = feedData.items.map((item) => ({
        id: generateSnowflakeId(),
        feedId: feed.id,
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

      // Insert in batches of 50 to avoid hitting query size limits
      const BATCH_SIZE = 50
      for (let i = 0; i < postsToInsert.length; i += BATCH_SIZE) {
        const batch = postsToInsert.slice(i, i + BATCH_SIZE)
        const inserted = await db
          .insert(posts)
          .values(batch)
          .onConflictDoNothing()
          .returning({ id: posts.id })
        result.newPosts += inserted.length
      }
    }

    result.success = true
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)

    // Record error
    await db
      .update(feeds)
      .set({
        errorAt: new Date(),
        errorMessage: result.error,
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, feed.id))
      .catch(() => {
        // Ignore secondary error
      })
  }

  return result
}

/**
 * Sync all feeds in the database.
 *
 * @param options.concurrency - How many feeds to fetch in parallel (default 5)
 * @param options.staleMinutes - Only re-fetch feeds not fetched within this many minutes (default 0 = all)
 */
export async function syncAllFeeds(
  options: { concurrency?: number; staleMinutes?: number } = {},
): Promise<SyncSummary> {
  const { concurrency = 5, staleMinutes = 0 } = options
  const startTime = Date.now()

  // Build the query — optionally filter to stale feeds only
  let feedList: (typeof feeds.$inferSelect)[]

  // Scraper-backed feeds are owned by the Python scraper — never RSS-fetch them.
  const notScraperBacked = or(
    isNull(feeds.adapterType),
    not(inArray(feeds.adapterType, [...SCRAPLING_ADAPTER_TYPES])),
  )

  if (staleMinutes > 0) {
    const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000)
    feedList = await db.query.feeds.findMany({
      where: and(
        or(isNull(feeds.lastFetchedAt), lt(feeds.lastFetchedAt, staleThreshold)),
        notScraperBacked,
      ),
    })
  } else {
    feedList = await db.query.feeds.findMany({ where: notScraperBacked })
  }

  logger.info(`[FeedSync] Starting sync for ${feedList.length} feeds (concurrency=${concurrency})`)

  const results: SyncResult[] = []

  // Process feeds in batches for controlled concurrency
  for (let i = 0; i < feedList.length; i += concurrency) {
    const batch = feedList.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map((feed) => syncFeed(feed)))

    for (const r of batchResults) {
      results.push(r)
      const icon = r.skipped ? "⏭️" : r.success ? "✅" : "❌"
      const detail = r.skipped
        ? "scraper-backed, skipped"
        : r.success
          ? `${r.newPosts} new posts`
          : r.error
      logger.info(`[FeedSync] ${icon} ${r.feedTitle || r.url} — ${detail}`)
    }
  }

  const summary: SyncSummary = {
    totalFeeds: feedList.length,
    successCount: results.filter((r) => r.success && !r.skipped).length,
    errorCount: results.filter((r) => !r.success).length,
    skippedCount: results.filter((r) => r.skipped).length,
    newPostsTotal: results.reduce((sum, r) => sum + r.newPosts, 0),
    results,
    durationMs: Date.now() - startTime,
  }

  logger.info(
    `[FeedSync] Done — ${summary.successCount}/${summary.totalFeeds} succeeded, ` +
      `${summary.newPostsTotal} new posts, ${summary.durationMs}ms`,
  )

  return summary
}
