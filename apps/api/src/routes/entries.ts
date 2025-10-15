import { Hono } from "hono"

import { sendError, structuredSuccess } from "../utils/response.js"

const entries = new Hono()

// Mock entry data
const mockEntries = [
  {
    id: "entry-1",
    feedId: "feed-1",
    title: "Example Entry",
    url: "https://example.com/article-1",
    content: "<p>This is an example entry content</p>",
    description: "A brief description of the entry",
    author: "John Doe",
    authorUrl: null,
    authorAvatar: null,
    insertedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    guid: "example-guid-1",
    read: false,
    starred: false,
    readabilityContent: null,
    media: [],
    categories: ["technology"],
    attachments: [],
  },
  {
    id: "entry-2",
    feedId: "feed-1",
    title: "Another Entry",
    url: "https://example.com/article-2",
    content: "<p>Another example entry content</p>",
    description: "Another brief description",
    author: "Jane Smith",
    authorUrl: null,
    authorAvatar: null,
    insertedAt: new Date(Date.now() - 86400000).toISOString(),
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    guid: "example-guid-2",
    read: false,
    starred: false,
    readabilityContent: null,
    media: [],
    categories: ["news"],
    attachments: [],
  },
]

/**
 * GET /entries
 * List entries with pagination and filtering
 */
entries.get("/", (c) => {
  const page = Number(c.req.query("page")) || 1
  const limit = Number(c.req.query("limit")) || 20
  const feedId = c.req.query("feedId")
  const read = c.req.query("read")
  const starred = c.req.query("starred")

  let filtered = [...mockEntries]

  if (feedId) {
    filtered = filtered.filter((e) => e.feedId === feedId)
  }

  if (read !== undefined) {
    filtered = filtered.filter((e) => e.read === (read === "true"))
  }

  if (starred !== undefined) {
    filtered = filtered.filter((e) => e.starred === (starred === "true"))
  }

  const start = (page - 1) * limit
  const end = start + limit
  const paginatedEntries = filtered.slice(start, end)

  return c.json(
    structuredSuccess({
      data: paginatedEntries,
      total: filtered.length,
      page,
      limit,
      hasMore: end < filtered.length,
    }),
  )
})

/**
 * GET /entries/:id
 * Get entry by ID
 */
entries.get("/:id", (c) => {
  const id = c.req.param("id")
  const entry = mockEntries.find((e) => e.id === id)

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  return c.json(structuredSuccess(entry))
})

/**
 * PATCH /entries/:id
 * Update entry (mark as read, starred, etc.)
 */
entries.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json<{ read?: boolean; starred?: boolean }>()
  const entry = mockEntries.find((e) => e.id === id)

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  if (body.read !== undefined) {
    entry.read = body.read
  }

  if (body.starred !== undefined) {
    entry.starred = body.starred
  }

  return c.json(structuredSuccess(entry))
})

/**
 * POST /entries/:id/read
 * Mark entry as read
 */
entries.post("/:id/read", (c) => {
  const id = c.req.param("id")
  const entry = mockEntries.find((e) => e.id === id)

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  entry.read = true

  return c.json({ code: 0 })
})

/**
 * POST /entries/:id/unread
 * Mark entry as unread
 */
entries.post("/:id/unread", (c) => {
  const id = c.req.param("id")
  const entry = mockEntries.find((e) => e.id === id)

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  entry.read = false

  return c.json({ code: 0 })
})

/**
 * POST /entries/:id/star
 * Star an entry
 */
entries.post("/:id/star", (c) => {
  const id = c.req.param("id")
  const entry = mockEntries.find((e) => e.id === id)

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  entry.starred = true

  return c.json({ code: 0 })
})

/**
 * POST /entries/:id/unstar
 * Unstar an entry
 */
entries.post("/:id/unstar", (c) => {
  const id = c.req.param("id")
  const entry = mockEntries.find((e) => e.id === id)

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  entry.starred = false

  return c.json({ code: 0 })
})

export default entries
