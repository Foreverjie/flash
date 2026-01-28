/**
 * Integration Tests: Feeds Subscribe Endpoint
 * Tests the POST /feeds/subscribe API endpoint
 */
import { and, eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { db, feeds, subscriptions } from "../db/index.js"
import app from "../index.js"
import type { TestSession, TestUser } from "./mocks/auth.js"
import { cleanupTestUser, createAuthenticatedUser } from "./mocks/auth.js"
import { createRssHandler } from "./mocks/handlers.js"
import { server } from "./setup.js"

describe("POST /feeds/subscribe", () => {
  let testUser: TestUser
  let _testSession: TestSession
  let authHeaders: Record<string, string>
  let testFeedId: string

  // Create test user and feed before each test
  beforeEach(async () => {
    // Create authenticated user
    const auth = await createAuthenticatedUser({
      id: `test-user-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
    })
    testUser = auth.user
    _testSession = auth.session
    authHeaders = auth.headers

    // Add RSS handler for the test feed URL
    const testFeedUrl = "https://test-feed.example.com/rss.xml"
    server.use(createRssHandler(testFeedUrl))

    // Create a test feed in the database
    const [feed] = await db
      .insert(feeds)
      .values({
        id: `feed-${Date.now()}`,
        url: testFeedUrl,
        title: "Test Feed",
        description: "A test feed for integration testing",
      })
      .returning()

    if (!feed) {
      throw new Error("Failed to create test feed")
    }
    testFeedId = feed.id
  })

  // Cleanup after each test
  afterEach(async () => {
    // Delete test subscriptions first
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUser.id))

    // Delete test feed
    if (testFeedId) {
      await db.delete(feeds).where(eq(feeds.id, testFeedId))
    }

    // Delete test user (sessions cascade)
    await cleanupTestUser(testUser.id)
  })

  it("should create subscription for authenticated user", async () => {
    // Make request using Hono app.request
    const response = await app.request("/feeds/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        feedId: testFeedId,
        title: "My Custom Title",
        category: "Tech",
        isPrivate: false,
      }),
    })

    // Verify response
    expect(response.status).toBe(201)

    const json = (await response.json()) as {
      success: boolean
      data: {
        subscription: { feedId: string; userId: string; title: string; category: string }
        existed: boolean
      }
    }
    expect(json.success).toBe(true)
    expect(json.data.subscription).toBeDefined()
    expect(json.data.subscription.feedId).toBe(testFeedId)
    expect(json.data.subscription.userId).toBe(testUser.id)
    expect(json.data.subscription.title).toBe("My Custom Title")
    expect(json.data.subscription.category).toBe("Tech")
    expect(json.data.existed).toBe(false)

    // Verify subscription was inserted in database
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: and(eq(subscriptions.userId, testUser.id), eq(subscriptions.feedId, testFeedId)),
    })

    expect(dbSubscription).toBeDefined()
    expect(dbSubscription?.userId).toBe(testUser.id)
    expect(dbSubscription?.feedId).toBe(testFeedId)
    expect(dbSubscription?.title).toBe("My Custom Title")
    expect(dbSubscription?.category).toBe("Tech")
    expect(dbSubscription?.isPrivate).toBe(false)
  })

  it("should return 401 for unauthenticated request", async () => {
    const response = await app.request("/feeds/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // No auth headers
      },
      body: JSON.stringify({
        feedId: testFeedId,
      }),
    })

    expect(response.status).toBe(401)

    const json = (await response.json()) as { message: string }
    expect(json.message).toContain("Authentication")
  })

  it("should return 404 for non-existent feed", async () => {
    const response = await app.request("/feeds/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        feedId: "non-existent-feed-id",
      }),
    })

    expect(response.status).toBe(404)

    const json = (await response.json()) as { message: string }
    expect(json.message).toContain("not found")
  })

  it("should return existing subscription if already subscribed", async () => {
    // First subscription
    await app.request("/feeds/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        feedId: testFeedId,
      }),
    })

    // Second subscription attempt
    const response = await app.request("/feeds/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        feedId: testFeedId,
      }),
    })

    expect(response.status).toBe(200)

    const json = (await response.json()) as { success: boolean; data: { existed: boolean } }
    expect(json.success).toBe(true)
    expect(json.data.existed).toBe(true)

    // Verify only one subscription exists
    const subscriptionCount = await db.query.subscriptions.findMany({
      where: and(eq(subscriptions.userId, testUser.id), eq(subscriptions.feedId, testFeedId)),
    })

    expect(subscriptionCount).toHaveLength(1)
  })

  it("should increment feed subscription count", async () => {
    // Get initial subscription count
    const feedBefore = await db.query.feeds.findFirst({
      where: eq(feeds.id, testFeedId),
    })
    const initialCount = feedBefore?.subscriptionCount ?? 0

    // Subscribe
    await app.request("/feeds/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        feedId: testFeedId,
      }),
    })

    // Check subscription count increased
    const feedAfter = await db.query.feeds.findFirst({
      where: eq(feeds.id, testFeedId),
    })

    expect(feedAfter?.subscriptionCount).toBe(initialCount + 1)
  })
})
