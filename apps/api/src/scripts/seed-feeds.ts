/* eslint-disable unicorn/no-process-exit */
/**
 * Seed the database with popular RSS feeds and their posts.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/seed-feeds.ts
 */
import "dotenv/config"

import { eq } from "drizzle-orm"

import { db, feeds, posts } from "../db/index.js"
import { rssManager } from "../lib/rss/index.js"
import { generateSnowflakeId } from "../utils/id.js"

// A curated list of popular, reliable RSS feeds
const SEED_FEEDS = [
  "https://hnrss.org/frontpage",
  "https://www.theverge.com/rss/index.xml",
  "https://feeds.arstechnica.com/arstechnica/index",
  "https://blog.rust-lang.org/feed.xml",
  "https://github.blog/feed/",
  "https://developer.chrome.com/blog/feed.xml",
  "https://www.smashingmagazine.com/feed/",
]

async function main() {
  console.info("\n🌱 Seeding database with RSS feeds...\n")

  let addedFeeds = 0
  let addedPosts = 0

  for (const url of SEED_FEEDS) {
    // Check if feed already exists
    const existing = await db.query.feeds.findFirst({
      where: eq(feeds.url, url),
    })

    if (existing) {
      console.info(`  ⏭  Skipping (exists): ${url}`)
      continue
    }

    console.info(`  📡 Fetching: ${url}`)

    const result = await rssManager.fetch(url)

    if (!result.success || !result.data) {
      console.info(`  ❌ Failed: ${result.error || "unknown error"}`)
      continue
    }

    const feedData = result.data

    // Insert the feed
    const [newFeed] = await db
      .insert(feeds)
      .values({
        id: generateSnowflakeId(),
        url,
        title: feedData.title,
        description: feedData.description,
        siteUrl: feedData.siteUrl,
        image: feedData.image,
        language: feedData.language,
        lastBuildDate: feedData.lastBuildDate,
        ttl: feedData.ttl,
        lastFetchedAt: new Date(),
      })
      .returning()

    if (!newFeed) {
      console.info(`  ❌ Failed to insert feed`)
      continue
    }

    addedFeeds++

    // Insert posts (up to 30 per feed)
    const items = feedData.items.slice(0, 30)
    let feedPostCount = 0

    for (const item of items) {
      try {
        await db
          .insert(posts)
          .values({
            id: generateSnowflakeId(),
            feedId: newFeed.id,
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
          })
          .onConflictDoNothing()
        feedPostCount++
      } catch {
        // Skip duplicate posts
      }
    }

    addedPosts += feedPostCount
    console.info(`  ✅ ${feedData.title || url} — ${feedPostCount} posts`)
  }

  console.info(`\n📊 Seed complete:`)
  console.info(`   Feeds added:  ${addedFeeds}`)
  console.info(`   Posts added:   ${addedPosts}\n`)

  process.exit(0)
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
