import { Hono } from "hono"

import { ok } from "../types"

// Minimal feed and entry shapes to keep response deterministic and type-safe
interface MinimalFeed {
  id: string
  url: string
  title: string
  description?: string | null
  siteUrl?: string | null
  image?: string | null
}

interface MinimalParsedEntry {
  id: string
  title: string | null
  description: string | null
  url: string | null
  publishedAt: string
  author?: string | null
}

function mockFeed(id: string, url?: string): MinimalFeed {
  return {
    id,
    url: url ?? `https://example.com/feed/${id}.xml`,
    title: `Feed ${id}`,
    description: `Mock feed for ${id}`,
    siteUrl: `https://example.com/${id}`,
    image: `https://picsum.photos/seed/${encodeURIComponent(id)}/64/64`,
  }
}

function mockEntries(count: number, feedId: string): MinimalParsedEntry[] {
  const now = Date.now()
  return Array.from({ length: count }).map((_, i) => ({
    id: `${feedId}-entry-${i + 1}`,
    title: `Sample entry ${i + 1}`,
    description: `This is a mock description for entry ${i + 1}.`,
    url: `https://example.com/${feedId}/entry/${i + 1}`,
    publishedAt: new Date(now - i * 3600_000).toISOString(),
    author: "Mock Author",
  }))
}

export const feedsRoutes = new Hono()
  // GET /api/feeds? id=... | url=... & entriesLimit=
  .get("/", (c) => {
    const id = c.req.query("id") || "demo"
    const url = c.req.query("url") || undefined
    const entriesLimit = Number(c.req.query("entriesLimit") ?? 10)

    const feed = mockFeed(id, url)
    const entries = mockEntries(Number.isFinite(entriesLimit) ? entriesLimit : 10, id)

    return c.json(
      ok({
        feed,
        entries,
        subscription: null as unknown,
        readCount: Math.floor(Math.random() * 500),
        subscriptionCount: Math.floor(Math.random() * 5000),
        analytics: {
          views7d: Math.floor(Math.random() * 1000),
          subscribers: Math.floor(Math.random() * 5000),
        },
      }),
    )
  })
  // POST /api/feeds/refresh { id: string }
  .post("/refresh", async (c) => {
    // No-op for mock
    const _ = await c.req.json().catch(() => ({}))
    return c.json(ok(null))
  })
  // POST /api/feeds/reset { id: string }
  .post("/reset", async (c) => {
    const _ = await c.req.json().catch(() => ({}))
    return c.json(ok(null))
  })
  // POST /api/feeds/analytics { id: string[] }
  .post("/analytics", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { id?: string[] }
    const ids = body.id ?? []
    const analytics: Record<string, { views7d: number; subscribers: number }> = {}
    ids.forEach((id) => {
      analytics[id] = {
        views7d: Math.floor(Math.random() * 1000),
        subscribers: Math.floor(Math.random() * 5000),
      }
    })
    return c.json(ok({ analytics }))
  })
  // POST /api/feeds/claim/challenge { feedId: string }
  .post("/claim/challenge", async (c) => {
    const _ = await c.req.json().catch(() => ({}))
    return c.json(ok(null))
  })
  // GET /api/feeds/claim/list
  .get("/claim/list", (c) => {
    const items = ["alpha", "beta", "gamma"].map((id, i) => ({
      feed: mockFeed(id),
      subscriptionCount: 100 + i * 17,
      tipAmount: i * 3,
    }))
    return c.json(ok(items))
  })
  // GET /api/feeds/claim/message?feedId=...
  .get("/claim/message", (c) => {
    const feedId = c.req.query("feedId") || "demo"
    return c.json(
      ok({
        content: `Verification for feed ${feedId}`,
        description: "Place this on your site to verify ownership.",
        json: JSON.stringify({ feedId, verify: true }),
        xml: `<verify feedId="${feedId}"/>`,
      }),
    )
  })
