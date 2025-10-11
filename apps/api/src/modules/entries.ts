import { Hono } from "hono"

import { ok } from "../types"

interface MinimalEntry {
  id: string
  title: string | null
  description: string | null
  url: string | null
  publishedAt: string
  content?: string | null
  feedId?: string
}

function mockEntry(id: string, feedId?: string): MinimalEntry {
  return {
    id,
    title: `Entry ${id}`,
    description: `Mock description for ${id}`,
    url: `https://example.com/entries/${id}`,
    publishedAt: new Date(Date.now() - Math.floor(Math.random() * 86400_000)).toISOString(),
    content: `Mock content for ${id}`,
    feedId,
  }
}

export const entriesRoutes = new Hono()
  // GET /api/entries/list
  .get("/list", (c) => {
    const view = c.req.query("view")
    const feedId = c.req.query("feedId") ?? "demo"
    const limit = Number(c.req.query("limit") ?? 10)
    const items = Array.from({ length: Number.isFinite(limit) ? limit : 10 }).map((_, i) => {
      const id = `${feedId}-${i + 1}`
      return {
        read: Math.random() > 0.5,
        view: view ?? 0,
        from: [],
        feeds: { id: feedId, title: `Feed ${feedId}` },
        entries: (({ content, feedId: _f, ...rest }) => rest)(mockEntry(id, feedId)),
      }
    })
    return c.json(ok(items))
  })

  // GET /api/entries/preview?id=...
  .get("/preview", (c) => {
    const id = c.req.query("id") || "preview-id"
    const entry = (({ feedId: _f, ...rest }) => rest)(mockEntry(id))
    return c.json(ok(entry))
  })
  // GET /api/entries/readability?id=...
  .get("/readability", (c) => {
    const id = c.req.query("id") || "readability-id"
    return c.json(ok<{ content?: string } | null>({ content: `Readable content for ${id}` }))
  })
  // POST /api/entries/transcription { url }
  .post("/transcription", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { url?: string }
    const duration = Math.floor(Math.random() * 600)
    return c.json(
      ok<{ srt: string; duration: number } | null>({
        srt: `1\n00:00:00,000 --> 00:00:05,000\nTranscript for ${body.url ?? "unknown"}\n`,
        duration,
      }),
    )
  })
  // POST /api/entries/stream { ids: string[] } — mock line-delimited JSON stream
  .post("/stream", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { ids?: string[] }
    const ids = body.ids ?? []
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        ids.forEach((id) => {
          const item = { id, content: `Streamed content for ${id}` }
          controller.enqueue(encoder.encode(`${JSON.stringify(item)}\n`))
        })
        controller.close()
      },
    })
    return new Response(stream, { headers: { "content-type": "application/x-ndjson" } })
  })
  // GET /api/entries/check-new?insertedAfter=...
  .get("/check-new", (c) => {
    const insertedAfter = Number(c.req.query("insertedAfter") ?? 0)
    const hasNew = Date.now() - insertedAfter > 60_000
    return c.json(
      ok<{ has_new: boolean; lastest_at?: string; entry_id?: string }>({
        has_new: hasNew,
        lastest_at: hasNew ? new Date().toISOString() : undefined,
        entry_id: hasNew ? "new-entry-id" : undefined,
      }),
    )
  })
  // GET /api/entries/read-histories?id=...&page=&size=
  .get("/read-histories", (c) => {
    // const id = c.req.query("id") || "demo"
    const users = {
      u1: { id: "u1", handle: "alice", name: "Alice", image: null },
      u2: { id: "u2", handle: "bob", name: "Bob", image: null },
    }
    return c.json(
      ok({
        users,
        total: 2,
        entryReadHistories: { userIds: Object.keys(users), readCount: 2 },
      }),
    )
  })
  // Inbox sub-routes
  .get("/inbox/get", (c) => {
    const id = c.req.query("id") || "inbox-entry"
    return c.json(
      ok({
        feeds: { id: "inbox-feed", title: "Inbox Feed" },
        entries: mockEntry(id),
      }),
    )
  })
  .get("/inbox/list", (c) => {
    const inboxId = c.req.query("inboxId") || "inbox-1"
    const items = Array.from({ length: 5 }).map((_, i) => ({
      read: i % 2 === 0,
      feeds: { id: inboxId, title: `Inbox ${inboxId}` },
      entries: (({ content, ...rest }) => rest)(mockEntry(`${inboxId}-${i + 1}`)),
    }))
    return c.json(ok(items))
  })
  .delete("/inbox/delete", async (c) => {
    const _ = await c.req.json().catch(() => ({}))
    return c.json(ok({}))
  })
  // GET /api/entries/:id — keep this last to avoid matching specific routes
  .get("/:id", (c) => {
    const id = c.req.param("id")
    const feedId = "demo"
    const entries = (({ feedId: _f, ...rest }) => rest)(mockEntry(id, feedId))
    return c.json(
      ok({ feeds: { id: feedId, title: `Feed ${feedId}` }, entries, settings: undefined }),
    )
  })
