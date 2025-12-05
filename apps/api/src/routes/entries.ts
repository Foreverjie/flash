import { entriesTable } from "@flash/database/schemas/index"
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"

import { db } from "../db.js"
import { sendError, structuredSuccess } from "../utils/response.js"

const entries = new Hono()

/**
 * GET /entries
 * List entries with pagination and filtering
 */
entries.get("/", async (c) => {
  const page = Number(c.req.query("page")) || 1
  const limit = Number(c.req.query("limit")) || 20
  const offset = (page - 1) * limit
  const feedId = c.req.query("feedId")
  const read = c.req.query("read")

  // Build where conditions
  const conditions: any[] = []
  if (feedId) {
    conditions.push(eq(entriesTable.feedId, feedId))
  }
  if (read !== undefined) {
    conditions.push(eq(entriesTable.read, read === "true"))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [paginatedEntries, allEntries] = await Promise.all([
    db.query.entriesTable.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: (t, { desc }) => [desc(t.publishedAt)],
    }),
    db.query.entriesTable.findMany({
      where: whereClause,
    }),
  ])

  return c.json(
    structuredSuccess({
      data: paginatedEntries,
      total: allEntries.length,
      page,
      limit,
      hasMore: offset + limit < allEntries.length,
    }),
  )
})

/**
 * GET /entries/:id
 * Get entry by ID
 */
entries.get("/:id", async (c) => {
  const id = c.req.param("id")
  const entry = await db.query.entriesTable.findFirst({
    where: eq(entriesTable.id, id),
  })

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
  const body = await c.req.json<{ read?: boolean }>()

  const entry = await db.query.entriesTable.findFirst({
    where: eq(entriesTable.id, id),
  })

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  const [updatedEntry] = await db
    .update(entriesTable)
    .set(body)
    .where(eq(entriesTable.id, id))
    .returning()

  return c.json(structuredSuccess(updatedEntry))
})

/**
 * POST /entries/:id/read
 * Mark entry as read
 */
entries.post("/:id/read", async (c) => {
  const id = c.req.param("id")

  const entry = await db.query.entriesTable.findFirst({
    where: eq(entriesTable.id, id),
  })

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  await db.update(entriesTable).set({ read: true }).where(eq(entriesTable.id, id))

  return c.json({ code: 0 })
})

/**
 * POST /entries/:id/unread
 * Mark entry as unread
 */
entries.post("/:id/unread", async (c) => {
  const id = c.req.param("id")

  const entry = await db.query.entriesTable.findFirst({
    where: eq(entriesTable.id, id),
  })

  if (!entry) {
    return sendError(c, "Entry not found", 404, 404)
  }

  await db.update(entriesTable).set({ read: false }).where(eq(entriesTable.id, id))

  return c.json({ code: 0 })
})

export default entries
