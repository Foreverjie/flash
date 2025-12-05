import { feedsTable } from "@flash/database/schemas/index"
import { eq } from "drizzle-orm"
import { Hono } from "hono"

import { db } from "../db.js"
import { sendError, structuredSuccess } from "../utils/response.js"

const feeds = new Hono()

/**
 * GET /feeds/:id
 * Get feed by ID
 */
feeds.get("/:id", async (c) => {
  const id = c.req.param("id")
  const feed = await db.query.feedsTable.findFirst({
    where: eq(feedsTable.id, id),
  })

  if (!feed) {
    return sendError(c, "Feed not found", 404, 404)
  }

  return c.json(structuredSuccess(feed))
})

/**
 * POST /feeds
 * Create or discover a feed
 */
feeds.post("/", async (c) => {
  const body = await c.req.json<{ url: string; title?: string; description?: string }>()

  // Create new feed
  const newFeedData = {
    id: `feed-${Date.now()}`,
    url: body.url,
    title: body.title || null,
    description: body.description || null,
    siteUrl: body.url,
    image: null,
    errorAt: null,
    errorMessage: null,
    ownerUserId: null,
    subscriptionCount: null,
    updatesPerWeek: null,
    latestEntryPublishedAt: null,
    tipUserIds: null,
    updatedAt: null,
  }

  const [newFeed] = await db.insert(feedsTable).values(newFeedData).returning()

  return c.json(structuredSuccess(newFeed))
})

/**
 * GET /feeds
 * List feeds with pagination
 */
feeds.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1
  const limit = Number(c.req.query("limit")) || 20
  const offset = (page - 1) * limit

  const [paginatedFeeds, totalFeeds] = await Promise.all([
    db.query.feedsTable.findMany({
      limit,
      offset,
    }),
    db.query.feedsTable.findMany(),
  ])

  return c.json(
    structuredSuccess({
      data: paginatedFeeds,
      total: totalFeeds.length,
      page,
      limit,
      hasMore: offset + limit < totalFeeds.length,
    }),
  )
})

/**
 * DELETE /feeds/:id
 * Delete a feed
 */
feeds.delete("/:id", async (c) => {
  const id = c.req.param("id")

  const feed = await db.query.feedsTable.findFirst({
    where: eq(feedsTable.id, id),
  })

  if (!feed) {
    return sendError(c, "Feed not found", 404, 404)
  }

  await db.delete(feedsTable).where(eq(feedsTable.id, id))

  return c.json({ code: 0 })
})

/**
 * PATCH /feeds/:id
 * Update feed
 */
feeds.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()

  const feed = await db.query.feedsTable.findFirst({
    where: eq(feedsTable.id, id),
  })

  if (!feed) {
    return sendError(c, "Feed not found", 404, 404)
  }

  const [updatedFeed] = await db
    .update(feedsTable)
    .set(body)
    .where(eq(feedsTable.id, id))
    .returning()

  return c.json(structuredSuccess(updatedFeed))
})

export default feeds
