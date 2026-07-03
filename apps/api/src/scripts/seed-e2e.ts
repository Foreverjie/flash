/* eslint-disable unicorn/no-process-exit */
/**
 * Seed a deterministic fixture set for e2e tests (and quick local dev data):
 * 3 topics, 5 feeds linked to them, and 10 posts across those feeds.
 *
 * Everything uses fixed `e2e-` ids/guids and fixed timestamps so Playwright
 * assertions can rely on exact titles and ordering.
 *
 * Usage:
 *   cd apps/api && pnpm run db:seed:e2e
 *
 * Idempotent: upserts by primary key / unique constraints; safe to re-run.
 */
import "dotenv/config"

import { eq } from "drizzle-orm"

import { db, feeds, feedTopics, posts, topics } from "../db/index.js"

const SEED_TOPICS = [
  {
    id: "e2e-topic-tech",
    slug: "tech",
    label: "Tech",
    description: "Mainstream technology news and analysis",
    color: "#3B82F6",
    sortOrder: 10,
  },
  {
    id: "e2e-topic-ai",
    slug: "ai",
    label: "AI",
    description: "Artificial intelligence research and product news",
    color: "#8B5CF6",
    sortOrder: 20,
  },
  {
    id: "e2e-topic-design",
    slug: "design",
    label: "Design",
    description: "Product design, typography, and visual culture",
    color: "#EC4899",
    sortOrder: 30,
  },
]

const SEED_FEEDS = [
  {
    id: "e2e-feed-daily-bits",
    url: "https://e2e.flash.test/feeds/daily-bits.xml",
    title: "Daily Bits",
    description: "Technology headlines, three times a day",
    siteUrl: "https://e2e.flash.test/daily-bits",
    topicIds: ["e2e-topic-tech"],
    subscriptionCount: 500,
  },
  {
    id: "e2e-feed-silicon-notes",
    url: "https://e2e.flash.test/feeds/silicon-notes.xml",
    title: "Silicon Notes",
    description: "Deep dives on the hardware industry",
    siteUrl: "https://e2e.flash.test/silicon-notes",
    topicIds: ["e2e-topic-tech"],
    subscriptionCount: 400,
  },
  {
    id: "e2e-feed-model-watch",
    url: "https://e2e.flash.test/feeds/model-watch.xml",
    title: "Model Watch",
    description: "Tracking frontier AI model releases",
    siteUrl: "https://e2e.flash.test/model-watch",
    topicIds: ["e2e-topic-ai"],
    subscriptionCount: 300,
  },
  {
    id: "e2e-feed-agents-weekly",
    url: "https://e2e.flash.test/feeds/agents-weekly.xml",
    title: "Agents Weekly",
    description: "A weekly roundup of AI agent tooling",
    siteUrl: "https://e2e.flash.test/agents-weekly",
    topicIds: ["e2e-topic-ai"],
    subscriptionCount: 200,
  },
  {
    id: "e2e-feed-grid-and-glyph",
    url: "https://e2e.flash.test/feeds/grid-and-glyph.xml",
    title: "Grid & Glyph",
    description: "Essays on interfaces and typography",
    siteUrl: "https://e2e.flash.test/grid-and-glyph",
    topicIds: ["e2e-topic-design"],
    subscriptionCount: 100,
  },
]

const SEED_POSTS = Array.from({ length: 10 }, (_, i) => {
  const feed = SEED_FEEDS[i % SEED_FEEDS.length]!
  const n = i + 1
  return {
    id: `e2e-post-${n}`,
    feedId: feed.id,
    guid: `e2e-post-${n}`,
    title: `E2E fixture post ${n} — ${feed.title}`,
    url: `${feed.siteUrl}/posts/${n}`,
    description: `Deterministic fixture entry ${n} for automated tests.`,
    content: `<p>Deterministic fixture entry ${n} from ${feed.title}. If you can read this in a test, the timeline pipeline works.</p>`,
    author: "Flash E2E",
    // Fixed, spaced timestamps so ordering assertions are stable
    publishedAt: new Date(Date.UTC(2026, 0, 1, 12, n)),
    language: "en",
    scrapeStatus: "completed",
  }
})

async function main() {
  console.info("\n🌱 Seeding e2e fixtures...\n")

  for (const t of SEED_TOPICS) {
    await db
      .insert(topics)
      .values(t)
      .onConflictDoUpdate({
        target: topics.slug,
        set: {
          label: t.label,
          description: t.description,
          color: t.color,
          sortOrder: t.sortOrder,
        },
      })
    console.info(`  + Topic: ${t.slug}`)
  }

  for (const f of SEED_FEEDS) {
    const { topicIds, ...feed } = f
    await db
      .insert(feeds)
      .values(feed)
      .onConflictDoUpdate({
        target: feeds.url,
        set: {
          title: feed.title,
          description: feed.description,
          siteUrl: feed.siteUrl,
          subscriptionCount: feed.subscriptionCount,
        },
      })
    // Feed id may differ if the url already existed with another id
    const row = await db.query.feeds.findFirst({ where: eq(feeds.url, feed.url) })
    const feedId = row!.id

    for (const rawTopicId of topicIds) {
      const { slug } = SEED_TOPICS.find((t) => t.id === rawTopicId)!
      const topic = await db.query.topics.findFirst({ where: eq(topics.slug, slug) })
      await db.insert(feedTopics).values({ feedId, topicId: topic!.id }).onConflictDoNothing()
    }
    console.info(`  + Feed: ${feed.title}`)
  }

  for (const p of SEED_POSTS) {
    const feedUrl = SEED_FEEDS.find((f) => f.id === p.feedId)!.url
    const row = await db.query.feeds.findFirst({ where: eq(feeds.url, feedUrl) })
    await db
      .insert(posts)
      .values({ ...p, feedId: row!.id })
      .onConflictDoNothing()
  }
  console.info(`  + Posts: ${SEED_POSTS.length}`)

  console.info("\n✅ E2E fixtures seeded\n")
  process.exit(0)
}

main().catch((error) => {
  console.error("❌ E2E seed failed:", error)
  process.exit(1)
})
