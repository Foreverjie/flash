/**
 * MSW Request Handlers
 * Mock external HTTP requests for testing
 */
import { http, HttpResponse } from "msw"

/**
 * Sample RSS XML response for testing
 */
export const sampleRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Blog</title>
    <link>https://example.com</link>
    <description>A test RSS feed for integration testing</description>
    <language>en</language>
    <lastBuildDate>Thu, 23 Jan 2026 00:00:00 GMT</lastBuildDate>
    <item>
      <title>Test Post 1</title>
      <link>https://example.com/post-1</link>
      <guid>https://example.com/post-1</guid>
      <description>This is the first test post</description>
      <pubDate>Thu, 22 Jan 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Test Post 2</title>
      <link>https://example.com/post-2</link>
      <guid>https://example.com/post-2</guid>
      <description>This is the second test post</description>
      <pubDate>Wed, 21 Jan 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

/**
 * Default MSW handlers for tests
 */
export const handlers = [
  // Mock RSS feed endpoint
  http.get("https://example.com/feed.xml", () => {
    return new HttpResponse(sampleRssXml, {
      headers: {
        "Content-Type": "application/xml",
      },
    })
  }),

  // Mock RSS feed at /rss path
  http.get("https://example.com/rss", () => {
    return new HttpResponse(sampleRssXml, {
      headers: {
        "Content-Type": "application/rss+xml",
      },
    })
  }),

  // Mock RSS feed at root /feed path
  http.get("https://example.com/feed", () => {
    return new HttpResponse(sampleRssXml, {
      headers: {
        "Content-Type": "application/xml",
      },
    })
  }),
]

/**
 * Create a custom RSS handler for a specific URL
 */
export function createRssHandler(url: string, xml: string = sampleRssXml, status = 200) {
  return http.get(url, () => {
    if (status !== 200) {
      return new HttpResponse(null, { status })
    }
    return new HttpResponse(xml, {
      headers: {
        "Content-Type": "application/xml",
      },
    })
  })
}
