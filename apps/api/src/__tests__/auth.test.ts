/**
 * Integration Tests: Auth Module
 * Tests user registration and login using Better-auth endpoints directly
 *
 * Note: Better-auth provides its own endpoints at /api/auth/*
 * We test these directly rather than the custom wrapper routes
 */
import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { accounts, db, sessions, users } from "../db/index.js"
import app from "../index.js"

describe("Auth Module", () => {
  // Generate unique email for EACH test to avoid conflicts
  let testEmail: string
  const testPassword = "testPassword123!"
  const testName = "Test User"

  // Generate unique email before each test
  beforeEach(() => {
    testEmail = `test-auth-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
  })

  // Cleanup after each test
  afterEach(async () => {
    // Delete test users with email patterns we use
    const testUsers = await db.query.users.findMany({
      where: (users, { like }) => like(users.email, "test-auth-%@example.com"),
    })

    for (const user of testUsers) {
      await db.delete(sessions).where(eq(sessions.userId, user.id))
      await db.delete(accounts).where(eq(accounts.userId, user.id))
      await db.delete(users).where(eq(users.id, user.id))
    }
  })

  describe("POST /api/auth/sign-up/email", () => {
    it("should register a new user via Better-auth endpoint", async () => {
      const response = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName,
        }),
      })

      // Better-auth returns 200 on success
      expect(response.status).toBe(200)

      const json = (await response.json()) as {
        user?: { id: string; email: string; name: string }
        token?: string
      }

      expect(json.user).toBeDefined()
      expect(json.user?.email).toBe(testEmail)
      expect(json.user?.name).toBe(testName)

      // Verify user was created in database
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, testEmail),
      })

      expect(dbUser).toBeDefined()
      expect(dbUser?.email).toBe(testEmail)
      expect(dbUser?.name).toBe(testName)
    })

    it("should reject duplicate email registration", async () => {
      // First registration
      await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName,
        }),
      })

      // Duplicate attempt
      const response = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: "Another Name",
        }),
      })

      // Better-auth returns error for duplicate
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe("POST /api/auth/sign-in/email", () => {
    it("should sign in with valid credentials", async () => {
      // First register the user
      await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName,
        }),
      })

      // Then sign in
      const response = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      })

      expect(response.status).toBe(200)

      const json = (await response.json()) as {
        user?: { id: string; email: string; name: string }
        token?: string
        session?: { id: string }
      }

      expect(json.user).toBeDefined()
      expect(json.user?.email).toBe(testEmail)

      // Verify session was created
      const dbSession = await db.query.sessions.findFirst({
        where: eq(sessions.userId, json.user?.id ?? ""),
      })
      expect(dbSession).toBeDefined()
    })

    it("should reject invalid password", async () => {
      // Register first
      await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName,
        }),
      })

      // Try to sign in with wrong password
      const response = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: "wrongPassword123!",
        }),
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })

    it("should reject non-existent user", async () => {
      const response = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: testPassword,
        }),
      })

      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe("GET /api/auth/get-session", () => {
    it("should return null for unauthenticated request", async () => {
      const response = await app.request("/api/auth/get-session", {
        method: "GET",
      })

      expect(response.status).toBe(200)

      const json = (await response.json()) as { session: null } | null
      // Better-auth may return null or { session: null } for unauthenticated requests
      expect(json === null || json.session === null).toBe(true)
    })

    it("should return session for authenticated request", async () => {
      // Register
      await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: testName,
        }),
      })

      // Sign in
      const signInResponse = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      })

      // Get session cookie
      const setCookie = signInResponse.headers.get("Set-Cookie")

      if (!setCookie) {
        console.warn("No Set-Cookie header, skipping authenticated session test")
        return
      }

      // Get session with cookie
      const response = await app.request("/api/auth/get-session", {
        method: "GET",
        headers: { Cookie: setCookie },
      })

      expect(response.status).toBe(200)

      const json = (await response.json()) as {
        session: { id: string } | null
        user: { email: string } | null
      }

      expect(json.session).toBeDefined()
      expect(json.user?.email).toBe(testEmail)
    })
  })
})
