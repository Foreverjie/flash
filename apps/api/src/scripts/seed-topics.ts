/* eslint-disable unicorn/no-process-exit */
/**
 * Seed the database with curated onboarding topics and feed-topic associations.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/seed-topics.ts
 *
 * Idempotent: re-running upserts topics by slug and skips existing feed_topic links.
 */
import "dotenv/config"

import { and, eq, like, or } from "drizzle-orm"

import { db, feeds, feedTopics, topics } from "../db/index.js"
import { generateSnowflakeId } from "../utils/id.js"

type SeedTopic = {
  slug: string
  label: string
  description: string
  color: string
  sortOrder: number
  /** URL fragments to match existing feeds against (case-insensitive `LIKE`). */
  feedMatchers: string[]
}

const SEED_TOPICS: SeedTopic[] = [
  {
    slug: "tech",
    label: "Tech",
    description: "Mainstream technology news and analysis",
    color: "#3B82F6",
    sortOrder: 10,
    feedMatchers: ["theverge.com", "arstechnica.com", "techcrunch.com", "wired.com"],
  },
  {
    slug: "ai",
    label: "AI",
    description: "Artificial intelligence research and product news",
    color: "#8B5CF6",
    sortOrder: 20,
    feedMatchers: ["openai.com", "anthropic.com", "deepmind", "huggingface", "ai.googleblog"],
  },
  {
    slug: "design",
    label: "Design",
    description: "Product design, typography, and visual culture",
    color: "#EC4899",
    sortOrder: 30,
    feedMatchers: ["smashingmagazine.com", "css-tricks.com", "rauno.me", "uxdesign.cc"],
  },
  {
    slug: "startups",
    label: "Startups",
    description: "Founders, fundraising, and early-stage companies",
    color: "#F97316",
    sortOrder: 40,
    feedMatchers: ["ycombinator", "stratechery", "lennysnewsletter", "firstround"],
  },
  {
    slug: "science",
    label: "Science",
    description: "Research, discovery, and the natural world",
    color: "#14B8A6",
    sortOrder: 50,
    feedMatchers: ["nature.com", "sciencemag.org", "quantamagazine", "scientificamerican"],
  },
  {
    slug: "programming",
    label: "Programming",
    description: "Languages, tools, and engineering practice",
    color: "#10B981",
    sortOrder: 60,
    feedMatchers: ["github.blog", "rust-lang.org", "developer.chrome.com", "go.dev"],
  },
  {
    slug: "culture",
    label: "Culture",
    description: "Arts, society, and the things people make",
    color: "#F59E0B",
    sortOrder: 70,
    feedMatchers: ["theringer", "newyorker", "nytimes.com", "theatlantic"],
  },
  {
    slug: "finance",
    label: "Finance",
    description: "Markets, economics, and money",
    color: "#06B6D4",
    sortOrder: 80,
    feedMatchers: ["bloomberg", "ft.com", "wsj.com", "stratechery"],
  },
]

async function main() {
  console.info("\n🌱 Seeding topics...\n")

  for (const t of SEED_TOPICS) {
    const existing = await db.query.topics.findFirst({ where: eq(topics.slug, t.slug) })
    let topicId: string
    if (existing) {
      topicId = existing.id
      await db
        .update(topics)
        .set({
          label: t.label,
          description: t.description,
          color: t.color,
          sortOrder: t.sortOrder,
        })
        .where(eq(topics.id, topicId))
      console.info(`  ↻ Updated topic: ${t.slug}`)
    } else {
      topicId = generateSnowflakeId()
      await db.insert(topics).values({
        id: topicId,
        slug: t.slug,
        label: t.label,
        description: t.description,
        color: t.color,
        sortOrder: t.sortOrder,
      })
      console.info(`  + Created topic: ${t.slug}`)
    }

    // Match existing feeds and link
    const matched =
      t.feedMatchers.length === 0
        ? []
        : await db
            .select()
            .from(feeds)
            .where(or(...t.feedMatchers.map((m) => like(feeds.url, `%${m}%`))))

    let linked = 0
    for (const feed of matched) {
      const link = await db.query.feedTopics.findFirst({
        where: and(eq(feedTopics.feedId, feed.id), eq(feedTopics.topicId, topicId)),
      })
      if (link) continue
      await db.insert(feedTopics).values({ feedId: feed.id, topicId })
      linked += 1
    }
    console.info(`    linked ${linked} feed(s) (${matched.length} matched)`)
  }

  console.info("\n✅ Done.\n")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .then(() => process.exit(0))
