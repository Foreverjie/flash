import { describe, expect, it } from "vitest"

import { FeedView, isFeedView, resolveFeedView, resolveSubscriptionView } from "./feed-view.js"

describe("resolveFeedView", () => {
  it("classifies regular and property sources as articles", () => {
    expect(resolveFeedView("default")).toBe(FeedView.Articles)
    expect(resolveFeedView("leyoujia_community")).toBe(FeedView.Articles)
    expect(resolveFeedView("qfang_community")).toBe(FeedView.Articles)
  })

  it("classifies source-specific adapters", () => {
    expect(resolveFeedView("x_timeline")).toBe(FeedView.SocialMedia)
    expect(resolveFeedView("bilibili_up_video")).toBe(FeedView.Videos)
  })

  it("uses a persisted subscription view before adapter inference", () => {
    expect(resolveSubscriptionView(FeedView.Pictures, "default")).toBe(FeedView.Pictures)
    expect(resolveSubscriptionView(undefined, "x_timeline")).toBe(FeedView.SocialMedia)
  })

  it("only accepts concrete feed views", () => {
    expect(isFeedView(FeedView.Notifications)).toBe(true)
    expect(isFeedView(-1)).toBe(false)
    expect(isFeedView(6)).toBe(false)
  })
})
