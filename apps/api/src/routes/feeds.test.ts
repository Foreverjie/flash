// apps/api/src/routes/feeds.test.ts
import { Hono } from "hono"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Mock DB — must be hoisted before any imports that pull in feeds.ts
vi.mock("../db/index.js", () => ({
  db: {
    query: { feeds: { findFirst: vi.fn() } },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  },
  feeds: {},
  posts: {},
}))

// Bypass auth for unit tests
vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  optionalAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}))

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("POST /feeds/:id/refresh — x_timeline branch", () => {
  beforeEach(async () => {
    vi.resetModules()
    process.env.SCRAPER_SERVICE_URL = "http://scraper.test"
    process.env.INTERNAL_API_KEY = "test-key"
  })

  it("returns newPosts from scraping service for x_timeline feed", async () => {
    const { db } = await import("../db/index.js")
    ;(db.query.feeds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "feed-123",
      url: "x_timeline://elonmusk",
      adapterType: "x_timeline",
    })

    server.use(http.post("http://scraper.test/scrape", () => HttpResponse.json({ inserted: 3 })))

    const { default: feedsRouter } = await import("./feeds.js")
    const app = new Hono()
    app.route("/feeds", feedsRouter)

    const res = await app.request("/feeds/feed-123/refresh", { method: "POST" })
    const body = (await res.json()) as { data: { newPosts: number } }

    expect(res.status).toBe(200)
    expect(body.data.newPosts).toBe(3)
  })

  it("returns 500 and records error when scraping service fails", async () => {
    const { db } = await import("../db/index.js")
    ;(db.query.feeds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "feed-123",
      url: "x_timeline://elonmusk",
      adapterType: "x_timeline",
    })

    server.use(
      http.post("http://scraper.test/scrape", () =>
        HttpResponse.json({ error: "blocked" }, { status: 503 }),
      ),
    )

    const { default: feedsRouter } = await import("./feeds.js")
    const app = new Hono()
    app.route("/feeds", feedsRouter)

    const res = await app.request("/feeds/feed-123/refresh", { method: "POST" })
    expect(res.status).toBe(500)
    // db.update should have been called to record the error
    expect(db.update).toHaveBeenCalled()
  })
})

describe("POST /feeds/:id/refresh — bilibili_up_video branch", () => {
  beforeEach(async () => {
    vi.resetModules()
    process.env.SCRAPER_SERVICE_URL = "http://scraper.test"
    process.env.INTERNAL_API_KEY = "test-key"
  })

  it("returns newPosts from scraping service for bilibili_up_video feed", async () => {
    const { db } = await import("../db/index.js")
    ;(db.query.feeds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "feed-bili-123",
      url: "bilibili_up_video://12345",
      adapterType: "bilibili_up_video",
    })

    let capturedBody: unknown
    server.use(
      http.post("http://scraper.test/scrape", async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ inserted: 2 })
      }),
    )

    const { default: feedsRouter } = await import("./feeds.js")
    const app = new Hono()
    app.route("/feeds", feedsRouter)

    const res = await app.request("/feeds/feed-bili-123/refresh", { method: "POST" })
    const body = (await res.json()) as { data: { newPosts: number } }

    expect(res.status).toBe(200)
    expect(body.data.newPosts).toBe(2)
    expect(capturedBody).toEqual({
      feed_id: "feed-bili-123",
      adapter_type: "bilibili_up_video",
      source: "12345",
    })
  })
})

describe("POST /feeds — x_timeline creation", () => {
  beforeEach(async () => {
    vi.resetModules()
    process.env.SCRAPER_SERVICE_URL = "http://scraper.test"
    process.env.INTERNAL_API_KEY = "test-key"
  })

  it("returns 201 with new feed when creating an x_timeline feed by handle", async () => {
    const { db } = await import("../db/index.js")
    // No existing feed found
    ;(db.query.feeds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    // Simulate insert returning new feed row
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([
            { id: "new-feed", url: "x_timeline://elonmusk", adapterType: "x_timeline" },
          ]),
      }),
    })
    ;(db as unknown as Record<string, unknown>).insert = mockInsert

    const { default: feedsRouter } = await import("./feeds.js")
    const app = new Hono()
    app.route("/feeds", feedsRouter)

    const res = await app.request("/feeds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "x_timeline", handle: "@elonmusk" }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { feed: { adapterType: string }; isNew: boolean } }
    expect(body.data.feed.adapterType).toBe("x_timeline")
    expect(body.data.isNew).toBe(true)
  })

  it("returns 201 with new feed when creating a bilibili_up_video feed by uid", async () => {
    const { db } = await import("../db/index.js")
    ;(db.query.feeds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "new-bili-feed",
            url: "bilibili_up_video://12345",
            adapterType: "bilibili_up_video",
          },
        ]),
      }),
    })
    ;(db as unknown as Record<string, unknown>).insert = mockInsert

    const { default: feedsRouter } = await import("./feeds.js")
    const app = new Hono()
    app.route("/feeds", feedsRouter)

    const res = await app.request("/feeds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "bilibili_up_video", uid: "12345" }),
    })

    expect(res.status).toBe(201)
    const body = (await res.json()) as { data: { feed: { adapterType: string }; isNew: boolean } }
    expect(body.data.feed.adapterType).toBe("bilibili_up_video")
    expect(body.data.isNew).toBe(true)
  })
})
