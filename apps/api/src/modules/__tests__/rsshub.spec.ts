import { describe, expect, it } from "vitest"

import { createApp } from "../../app"

describe.sequential("RSSHub module", () => {
  it("GET /api/rsshub/list returns instances", async () => {
    const app = createApp()
    const res = await app.request("/api/rsshub/list")
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(Array.isArray(json.data)).toBe(true)
  })

  it("POST /api/rsshub/create then GET /api/rsshub/get?id=... works", async () => {
    const app = createApp()
    const createRes = await app.request("/api/rsshub/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "inst_test", baseUrl: "https://example-rsshub.local" }),
    })
    expect(createRes.status).toBe(200)
    const created = await createRes.json()
    expect(created.code).toBe(0)

    const getRes = await app.request("/api/rsshub/get?id=inst_test")
    const getJson = await getRes.json()
    expect(getJson.code).toBe(0)
    expect(getJson.data.instance?.id).toBe("inst_test")
  })

  it("GET /api/rsshub/status returns usage/purchase structure", async () => {
    const app = createApp()
    const res = await app.request("/api/rsshub/status")
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data).toHaveProperty("usage")
  })
})
