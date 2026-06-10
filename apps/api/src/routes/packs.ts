/**
 * Starter Packs Routes
 * Curated feed bundles for the Discover surface. A pack can be followed as
 * a whole ("Follow all"), which bulk-subscribes the user to its feeds.
 */
import { zValidator } from "@hono/zod-validator"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { db, feeds, starterPackFeeds, starterPacks, subscriptions } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"
import { structuredSuccess } from "../utils/response.js"

type PacksVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const packsRouter = new Hono<{ Variables: PacksVariables }>()

/**
 * GET /packs
 * List starter packs with feed count and a few member previews for the card.
 */
packsRouter.get("/", async (c) => {
  const packs = await db
    .select()
    .from(starterPacks)
    .orderBy(asc(starterPacks.sortOrder), asc(starterPacks.name))

  if (packs.length === 0) {
    return c.json(structuredSuccess([]))
  }

  const members = await db
    .select({
      packId: starterPackFeeds.packId,
      sortOrder: starterPackFeeds.sortOrder,
      feedId: feeds.id,
      title: feeds.title,
      image: feeds.image,
      siteUrl: feeds.siteUrl,
      url: feeds.url,
    })
    .from(starterPackFeeds)
    .innerJoin(feeds, eq(feeds.id, starterPackFeeds.feedId))
    .where(
      inArray(
        starterPackFeeds.packId,
        packs.map((p) => p.id),
      ),
    )
    .orderBy(asc(starterPackFeeds.sortOrder), desc(feeds.subscriptionCount))

  const byPack = new Map<string, typeof members>()
  for (const m of members) {
    const list = byPack.get(m.packId) ?? []
    list.push(m)
    byPack.set(m.packId, list)
  }

  const data = packs.map((pack) => {
    const packMembers = byPack.get(pack.id) ?? []
    return {
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      description: pack.description,
      color: pack.color,
      feedCount: packMembers.length,
      previews: packMembers.slice(0, 4).map((m) => ({
        feedId: m.feedId,
        title: m.title,
        image: m.image,
        siteUrl: m.siteUrl,
      })),
    }
  })

  return c.json(structuredSuccess(data))
})

/**
 * POST /packs/:slug/subscribe
 * Subscribe the authenticated user to every feed in the pack. Idempotent.
 */
packsRouter.post(
  "/:slug/subscribe",
  requireAuth,
  zValidator("param", z.object({ slug: z.string().min(1) })),
  async (c) => {
    const user = c.get("user")!
    const { slug } = c.req.valid("param")

    const pack = await db.query.starterPacks.findFirst({ where: eq(starterPacks.slug, slug) })
    if (!pack) {
      return c.json({ code: 404, message: "Pack not found" }, 404)
    }

    const memberRows = await db
      .select({ feedId: starterPackFeeds.feedId })
      .from(starterPackFeeds)
      .where(eq(starterPackFeeds.packId, pack.id))
    const feedIds = memberRows.map((m) => m.feedId)
    if (feedIds.length === 0) {
      return c.json(structuredSuccess({ subscribed: 0, alreadySubscribed: 0 }))
    }

    const alreadySubbed = await db
      .select({ feedId: subscriptions.feedId })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, user.id), inArray(subscriptions.feedId, feedIds)))
    const alreadySet = new Set(alreadySubbed.map((s) => s.feedId))

    const toInsert = feedIds
      .filter((id) => !alreadySet.has(id))
      .map((feedId) => ({
        id: generateSnowflakeId(),
        userId: user.id,
        feedId,
        title: null,
        category: null,
        isPrivate: false,
      }))

    if (toInsert.length > 0) {
      await db.insert(subscriptions).values(toInsert).onConflictDoNothing()
      await db
        .update(feeds)
        .set({ subscriptionCount: sql`COALESCE(${feeds.subscriptionCount}, 0) + 1` })
        .where(
          inArray(
            feeds.id,
            toInsert.map((s) => s.feedId),
          ),
        )
      logger.info(
        `[Packs] User ${user.id} followed pack ${pack.slug} (${toInsert.length} new, ${alreadySet.size} existing)`,
      )
    }

    return c.json(
      structuredSuccess({ subscribed: toInsert.length, alreadySubscribed: alreadySet.size }),
    )
  },
)

export default packsRouter
