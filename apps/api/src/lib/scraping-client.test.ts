import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { ScrapingClient } from "./scraping-client"

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("ScrapingClient", () => {
  const client = new ScrapingClient("http://scraper.test", "test-key")

  it("calls POST /scrape with feedId, adapterType, and source", async () => {
    let capturedBody: unknown
    server.use(
      http.post("http://scraper.test/scrape", async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ inserted: 3 })
      }),
    )

    const result = await client.scrape({
      feedId: "123",
      adapterType: "x_timeline",
      source: "elonmusk",
    })
    expect(result).toEqual({ inserted: 3 })
    expect(capturedBody).toEqual({
      feed_id: "123",
      adapter_type: "x_timeline",
      source: "elonmusk",
    })
  })

  it("sends X-Internal-Key header", async () => {
    let capturedKey: string | null = null
    server.use(
      http.post("http://scraper.test/scrape", ({ request }) => {
        capturedKey = request.headers.get("x-internal-key")
        return HttpResponse.json({ inserted: 0 })
      }),
    )

    await client.scrape({ feedId: "1", adapterType: "x_timeline", source: "foo" })
    expect(capturedKey).toBe("test-key")
  })

  it("throws on non-2xx response", async () => {
    server.use(
      http.post("http://scraper.test/scrape", () =>
        HttpResponse.json({ error: "unavailable" }, { status: 503 }),
      ),
    )

    await expect(
      client.scrape({ feedId: "1", adapterType: "x_timeline", source: "foo" }),
    ).rejects.toThrow("503")
  })
})
