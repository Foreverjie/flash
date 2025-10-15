import { Hono } from "hono"

import { sendError, structuredSuccess } from "../utils/response.js"

const feeds = new Hono()

// Mock feed data
const mockFeeds = [
  {
    id: "feed-1",
    url: "https://example.com/feed.xml",
    title: "Example Feed",
    description: "An example RSS feed",
    siteUrl: "https://example.com",
    image: null,
    checkedAt: new Date().toISOString(),
    lastModifiedHeader: null,
    etagHeader: null,
    ttl: 3600,
    errorAt: null,
    errorMessage: null,
    ownerUserId: null as string | null,
  },
]

/**
 * GET /feeds/:id
 * Get feed by ID
 */
feeds.get("/:id", (c) => {
  const id = c.req.param("id")
  const feed = mockFeeds.find((f) => f.id === id)

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
  const body = await c.req.json<{ url: string }>()

  // Mock feed discovery
  const newFeed = {
    id: `feed-${Date.now()}`,
    url: body.url,
    title: "New Feed",
    description: "A newly discovered feed",
    siteUrl: body.url,
    image: null,
    checkedAt: new Date().toISOString(),
    lastModifiedHeader: null,
    etagHeader: null,
    ttl: 3600,
    errorAt: null,
    errorMessage: null,
    ownerUserId: "mock-user-id",
  }

  mockFeeds.push(newFeed)

  return c.json(structuredSuccess(newFeed))
})

/**
 * GET /feeds
 * List feeds with pagination
 */
feeds.get("/", (c) => {
  const page = Number(c.req.query("page")) || 1
  const limit = Number(c.req.query("limit")) || 20

  const start = (page - 1) * limit
  const end = start + limit
  const paginatedFeeds = mockFeeds.slice(start, end)

  return c.json(
    structuredSuccess({
      data: paginatedFeeds,
      total: mockFeeds.length,
      page,
      limit,
      hasMore: end < mockFeeds.length,
    }),
  )
})

/**
 * DELETE /feeds/:id
 * Delete a feed
 */
feeds.delete("/:id", (c) => {
  const id = c.req.param("id")
  const index = mockFeeds.findIndex((f) => f.id === id)

  if (index === -1) {
    return sendError(c, "Feed not found", 404, 404)
  }

  mockFeeds.splice(index, 1)

  return c.json({ code: 0 })
})

/**
 * PATCH /feeds/:id
 * Update feed
 */
feeds.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const feed = mockFeeds.find((f) => f.id === id)

  if (!feed) {
    return sendError(c, "Feed not found", 404, 404)
  }

  Object.assign(feed, body)

  return c.json(structuredSuccess(feed))
})

export default feeds
