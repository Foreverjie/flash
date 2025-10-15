import { Hono } from "hono"

import { structuredSuccess } from "../utils/response.js"

const auth = new Hono()

/**
 * GET /auth/session
 * Get current user session
 */
auth.get("/session", (c) => {
  // Mock session response
  // TODO: Integrate with real session management (Better Auth)
  return c.json({
    code: 0,
    data: {
      session: {
        id: "mock-session-id",
        userId: "mock-user-id",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      user: {
        id: "mock-user-id",
        name: "Demo User",
        email: "demo@follow.is",
        handle: "demo",
        image: null,
        createdAt: new Date().toISOString(),
      },
      role: "user" as const,
    },
  })
})

/**
 * POST /auth/sign-in
 * Sign in (placeholder)
 */
auth.post("/sign-in", async (c) => {
  const body = await c.req.json()

  // Mock sign in
  return c.json(
    structuredSuccess({
      session: {
        id: "new-session-id",
        userId: "mock-user-id",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      user: {
        id: "mock-user-id",
        name: body.name || "Demo User",
        email: body.email || "demo@follow.is",
        handle: body.handle || "demo",
        image: null,
        createdAt: new Date().toISOString(),
      },
    }),
  )
})

/**
 * POST /auth/sign-out
 * Sign out (placeholder)
 */
auth.post("/sign-out", (c) => {
  return c.json({ code: 0 })
})

export default auth
