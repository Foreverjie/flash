import { describe, expect, it } from "vitest"

import { createApp } from "../../app"

describe("Entries module", () => {
  it("GET /api/entries/list returns list items", async () => {
    const app = createApp()
    const res = await app.request("/api/entries/list?feedId=demo&limit=3")
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBe(3)
  })

  it("GET /api/entries/:id returns entry with feed", async () => {
    const app = createApp()
    const res = await app.request("/api/entries/demo-1")
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.feeds).toBeTruthy()
    expect(json.data.entries).toBeTruthy()
  })

  it("preview and readability endpoints respond with data", async () => {
    const app = createApp()
    const preview = await app.request("/api/entries/preview?id=pre-1")
    const previewJson = await preview.json()
    expect(previewJson.code).toBe(0)
    expect(previewJson.data.id).toBe("pre-1")

    const readability = await app.request("/api/entries/readability?id=rb-1")
    const readabilityJson = await readability.json()
    expect(readabilityJson.code).toBe(0)
    expect(readabilityJson.data.content).toContain("rb-1")
  })

  it("transcription endpoint returns srt and duration", async () => {
    const app = createApp()
    const res = await app.request("/api/entries/transcription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/audio.mp3" }),
    })
    const json = await res.json()
    expect(json.code).toBe(0)
    expect(json.data.srt).toContain("Transcript")
    expect(typeof json.data.duration).toBe("number")
  })

  it("stream endpoint returns NDJSON for provided ids", async () => {
    const app = createApp()
    const res = await app.request("/api/entries/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids: ["a", "b"] }),
    })
    expect(res.status).toBe(200)
    const text = await res.text()
    const lines = text.trim().split("\n")
    expect(lines.length).toBe(2)
    const first = JSON.parse(lines[0])
    expect(first.id).toBe("a")
  })

  it("check-new and read-histories endpoints respond with expected shape", async () => {
    const app = createApp()
    const check = await app.request("/api/entries/check-new?insertedAfter=0")
    const checkJson = await check.json()
    expect(checkJson.code).toBe(0)
    expect(typeof checkJson.data.has_new).toBe("boolean")

    const rh = await app.request("/api/entries/read-histories?id=demo")
    const rhJson = await rh.json()
    expect(rhJson.code).toBe(0)
    expect(rhJson.data.total).toBeGreaterThan(0)
  })

  it("inbox subroutes return success", async () => {
    const app = createApp()
    const inboxGet = await app.request("/api/entries/inbox/get?id=ib-1")
    const inboxGetJson = await inboxGet.json()
    expect(inboxGetJson.code).toBe(0)

    const inboxList = await app.request("/api/entries/inbox/list?inboxId=ib-1")
    const inboxListJson = await inboxList.json()
    expect(inboxListJson.code).toBe(0)

    const inboxDelete = await app.request("/api/entries/inbox/delete", { method: "DELETE" })
    const inboxDeleteJson = await inboxDelete.json()
    expect(inboxDeleteJson.code).toBe(0)
  })
})
