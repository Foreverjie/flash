// apps/api/src/routes/internal-scrapling.test.ts
import { Hono } from "hono"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import internalScraplingRouter from "./internal-scrapling"

// Helper: mount router without touching env (env is set via vi.stubEnv)
function makeApp() {
  const app = new Hono()
  app.route("/internal/scrapling", internalScraplingRouter)
  return app
}

describe("GET /internal/scrapling/feeds", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_API_KEY", "test-key")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 without correct key", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "real-key")
    const app = makeApp()
    const res = await app.request("/internal/scrapling/feeds", {
      headers: { "x-internal-key": "wrong-key" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 200 with feed list when key is valid", async () => {
    const app = makeApp()
    const res = await app.request("/internal/scrapling/feeds", {
      headers: { "x-internal-key": "test-key" },
    })
    // DB may be empty in unit test — just check shape
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("data")
    expect(Array.isArray(body.data)).toBe(true)
  })
})

describe("POST /internal/scrapling/ingest", () => {
  beforeEach(() => {
    vi.stubEnv("INTERNAL_API_KEY", "test-key")
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns 401 without correct key", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "real-key")
    const app = makeApp()
    const res = await app.request("/internal/scrapling/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": "wrong" },
      body: JSON.stringify({ feedId: "1", posts: [] }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 when feedId is missing", async () => {
    const app = makeApp()
    const res = await app.request("/internal/scrapling/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": "test-key" },
      body: JSON.stringify({ posts: [] }),
    })
    expect(res.status).toBe(400)
  })
})
