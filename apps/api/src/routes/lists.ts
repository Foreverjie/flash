import { Hono } from "hono"

import { sendError, structuredSuccess } from "../utils/response.js"

const lists = new Hono()

// Mock list data
const mockLists = [
  {
    id: "list-1",
    title: "My Reading List",
    description: "A curated list of feeds",
    view: 0,
    fee: 0,
    ownerUserId: "mock-user-id",
    image: null as string | null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

// Mock list subscriptions
const mockSubscriptions: Array<{
  listId: string
  feedId: string
  view: number
  category: string | null
  isPrivate: boolean
}> = [
  {
    listId: "list-1",
    feedId: "feed-1",
    view: 0,
    category: null,
    isPrivate: false,
  },
]

/**
 * GET /lists
 * List all lists
 */
lists.get("/", (c) => {
  return c.json(structuredSuccess(mockLists))
})

/**
 * GET /lists/:id
 * Get list by ID
 */
lists.get("/:id", (c) => {
  const id = c.req.param("id")
  const list = mockLists.find((l) => l.id === id)

  if (!list) {
    return sendError(c, "List not found", 404, 404)
  }

  return c.json(structuredSuccess(list))
})

/**
 * POST /lists
 * Create a new list
 */
lists.post("/", async (c) => {
  const body = await c.req.json<{
    title: string
    description?: string
    view?: number
    fee?: number
    image?: string
  }>()

  const newList = {
    id: `list-${Date.now()}`,
    title: body.title,
    description: body.description || "",
    view: body.view || 0,
    fee: body.fee || 0,
    ownerUserId: "mock-user-id",
    image: body.image || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  mockLists.push(newList)

  return c.json(structuredSuccess(newList))
})

/**
 * PATCH /lists/:id
 * Update list
 */
lists.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()
  const list = mockLists.find((l) => l.id === id)

  if (!list) {
    return sendError(c, "List not found", 404, 404)
  }

  Object.assign(list, body, { updatedAt: new Date().toISOString() })

  return c.json(structuredSuccess(list))
})

/**
 * DELETE /lists/:id
 * Delete list
 */
lists.delete("/:id", (c) => {
  const id = c.req.param("id")
  const index = mockLists.findIndex((l) => l.id === id)

  if (index === -1) {
    return sendError(c, "List not found", 404, 404)
  }

  mockLists.splice(index, 1)

  return c.json({ code: 0 })
})

/**
 * GET /lists/:id/feeds
 * Get feeds in a list
 */
lists.get("/:id/feeds", (c) => {
  const id = c.req.param("id")
  const list = mockLists.find((l) => l.id === id)

  if (!list) {
    return sendError(c, "List not found", 404, 404)
  }

  const listFeeds = mockSubscriptions.filter((s) => s.listId === id)

  return c.json(structuredSuccess(listFeeds))
})

/**
 * POST /lists/:id/feeds
 * Add feed to list
 */
lists.post("/:id/feeds", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json<{
    feedId: string
    view?: number
    category?: string
    isPrivate?: boolean
  }>()

  const list = mockLists.find((l) => l.id === id)

  if (!list) {
    return sendError(c, "List not found", 404, 404)
  }

  const subscription = {
    listId: id,
    feedId: body.feedId,
    view: body.view || 0,
    category: body.category || null,
    isPrivate: body.isPrivate || false,
  }

  mockSubscriptions.push(subscription)

  return c.json(structuredSuccess(subscription))
})

/**
 * DELETE /lists/:id/feeds/:feedId
 * Remove feed from list
 */
lists.delete("/:id/feeds/:feedId", (c) => {
  const listId = c.req.param("id")
  const feedId = c.req.param("feedId")

  const index = mockSubscriptions.findIndex((s) => s.listId === listId && s.feedId === feedId)

  if (index === -1) {
    return sendError(c, "Subscription not found", 404, 404)
  }

  mockSubscriptions.splice(index, 1)

  return c.json({ code: 0 })
})

export default lists
