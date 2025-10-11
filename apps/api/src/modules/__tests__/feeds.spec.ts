import { describe, expect, it } from "vitest"

import { createApp } from "../../app"

describe("Feeds module", () => {
  it("GET /api/feeds returns feed and entries", async () => {
    const app = createApp()
    const res = await app.request("/api/feeds?id=test-feed&entriesLimit=2")
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.feed.id).toBe("test-feed")
    expect(Array.isArray(json.data.entries)).toBe(true)
    expect(json.data.entries.length).toBe(2)
  })

  it("POST /api/feeds/analytics aggregates analytics", async () => {
    const app = createApp()
    const res = await app.request("/api/feeds/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: ["a", "b"] }),
    })
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.analytics).toHaveProperty("a")
    expect(json.data.analytics).toHaveProperty("b")
  })

  it("claim routes respond with success", async () => {
    const app = createApp()
    const listRes = await app.request("/api/feeds/claim/list")
    expect(listRes.status).toBe(200)
    const listJson = await listRes.json()
    expect(listJson.code).toBe(0)
    expect(Array.isArray(listJson.data)).toBe(true)

    const msgRes = await app.request("/api/feeds/claim/message?feedId=demo")
    const msgJson = await msgRes.json()
    expect(msgJson.code).toBe(0)
    expect(msgJson.data.content).toContain("demo")
  })
})
