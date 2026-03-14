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
})
