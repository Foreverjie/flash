import { describe, expect, it } from "vitest"

import { isScraperBackedFeedUrl } from "./app"

describe("isScraperBackedFeedUrl", () => {
  it("recognises every scraper-backed scheme", () => {
    expect(isScraperBackedFeedUrl("leyoujia_community://850254")).toBe(true)
    expect(isScraperBackedFeedUrl("qfang_community://123")).toBe(true)
    expect(isScraperBackedFeedUrl("bilibili_up_video://946974")).toBe(true)
    expect(isScraperBackedFeedUrl("x_timeline://someone")).toBe(true)
  })

  it("does not match ordinary RSS feeds", () => {
    expect(isScraperBackedFeedUrl("https://example.com/rss.xml")).toBe(false)
    expect(isScraperBackedFeedUrl("http://leyoujia_community.example.com/feed")).toBe(false)
  })

  it("handles missing urls", () => {
    expect(isScraperBackedFeedUrl()).toBe(false)
    expect(isScraperBackedFeedUrl(null)).toBe(false)
    expect(isScraperBackedFeedUrl("")).toBe(false)
  })
})
