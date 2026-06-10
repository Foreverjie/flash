/* eslint-disable unicorn/no-process-exit */
/**
 * Seed the database with curated starter packs and pack-feed associations.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/seed-packs.ts
 *
 * Idempotent: re-running upserts packs by slug and skips existing pack_feed links.
 */
import "dotenv/config"

import { eq, like, or } from "drizzle-orm"

import { db, feeds, starterPackFeeds, starterPacks } from "../db/index.js"
import { generateSnowflakeId } from "../utils/id.js"

type SeedPack = {
  slug: string
  name: string
  description: string
  color: string
  sortOrder: number
  /** URL fragments to match existing feeds against (case-insensitive `LIKE`). */
  feedMatchers: string[]
}

const SEED_PACKS: SeedPack[] = [
  {
    slug: "design-greats",
    name: "Design greats",
    description: "The blogs every product designer keeps in their reader.",
    color: "#EC407A",
    sortOrder: 10,
    feedMatchers: ["smashingmagazine.com", "css-tricks.com", "rauno.me", "uxdesign.cc", "nngroup"],
  },
  {
    slug: "ai-frontier",
    name: "AI frontier",
    description: "Labs, researchers and analysts worth following weekly.",
    color: "#7E57C2",
    sortOrder: 20,
    feedMatchers: ["openai.com", "anthropic.com", "deepmind", "huggingface", "simonwillison"],
  },
  {
    slug: "indie-web",
    name: "The indie web",
    description: "Personal sites and small blogs with big ideas.",
    color: "#66BB6A",
    sortOrder: 30,
    feedMatchers: ["daringfireball", "kottke.org", "waitbutwhy", "rauno.me", "overreacted"],
  },
  {
    slug: "tech-pulse",
    name: "Tech pulse",
    description: "Stay on top of the day's technology news.",
    color: "#42A5F5",
    sortOrder: 40,
    feedMatchers: ["theverge.com", "arstechnica.com", "techcrunch.com", "wired.com"],
  },
]

async function main() {
  console.info("\n🌱 Seeding starter packs...\n")

  for (const p of SEED_PACKS) {
    const existing = await db.query.starterPacks.findFirst({
      where: eq(starterPacks.slug, p.slug),
    })
    let packId: string
    if (existing) {
      packId = existing.id
      await db
        .update(starterPacks)
        .set({
          name: p.name,
          description: p.description,
          color: p.color,
          sortOrder: p.sortOrder,
        })
        .where(eq(starterPacks.id, packId))
      console.info(`  ↻ Updated pack: ${p.slug}`)
    } else {
      packId = generateSnowflakeId()
      await db.insert(starterPacks).values({
        id: packId,
        slug: p.slug,
        name: p.name,
        description: p.description,
        color: p.color,
        sortOrder: p.sortOrder,
      })
      console.info(`  + Created pack: ${p.slug}`)
    }

    const matchedFeeds = await db
      .select({ id: feeds.id, url: feeds.url })
      .from(feeds)
      .where(or(...p.feedMatchers.map((m) => like(feeds.url, `%${m}%`))))

    let linked = 0
    for (const [index, feed] of matchedFeeds.entries()) {
      const result = await db
        .insert(starterPackFeeds)
        .values({ packId, feedId: feed.id, sortOrder: index * 10 })
        .onConflictDoNothing()
        .returning()
      if (result.length > 0) linked += 1
    }
    console.info(`    ↳ ${matchedFeeds.length} feeds matched, ${linked} newly linked`)
  }

  console.info("\n✅ Starter packs seeded\n")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
