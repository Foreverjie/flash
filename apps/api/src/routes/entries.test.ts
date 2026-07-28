import { Hono } from "hono"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { resolveRequestedFeedViews } = vi.hoisted(() => ({
  resolveRequestedFeedViews: vi.fn(),
}))

vi.mock("../db/index.js", () => ({
  db: {},
  feeds: {},
  posts: {},
  readStatus: {},
}))

vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}))

vi.mock("../services/subscription-service.js", () => ({
  resolveRequestedFeedViews,
}))

describe("POST /entries subscription scope", () => {
  beforeEach(() => {
    resolveRequestedFeedViews.mockReset()
    resolveRequestedFeedViews.mockResolvedValue(new Map())
  })

  const createApp = async () => {
    const { default: entriesRouter } = await import("./entries.js")
    const app = new Hono()
    app.use("*", async (c, next) => {
      c.set("user" as never, { id: "user-1" } as never)
      await next()
    })
    app.route("/entries", entriesRouter)
    return app
  }

  it("scopes a timeline request to its concrete view", async () => {
    const app = await createApp()
    const response = await app.request("/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: 3 }),
    })

    expect(response.status).toBe(200)
    expect(resolveRequestedFeedViews).toHaveBeenCalledWith({
      userId: "user-1",
      view: 3,
      feedIds: undefined,
      excludePrivate: false,
    })
  })

  it("passes explicit feed IDs through deduplicated", async () => {
    const app = await createApp()
    await app.request("/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: 1, feedIdList: ["feed-1", "feed-1", "feed-2"] }),
    })

    expect(resolveRequestedFeedViews).toHaveBeenCalledWith({
      userId: "user-1",
      view: 1,
      feedIds: ["feed-1", "feed-2"],
      excludePrivate: false,
    })
  })

  it("rejects an invalid feed view", async () => {
    const app = await createApp()
    const response = await app.request("/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: 6 }),
    })

    expect(response.status).toBe(400)
    expect(resolveRequestedFeedViews).not.toHaveBeenCalled()
  })
})
