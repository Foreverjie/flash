import { Hono } from "hono"

// Minimal session + user structures for a stubbed response
interface AuthSession {
  id: string
  userId: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}

interface AuthUser {
  id: string
  name: string | null
  image: string | null
}

export const authRoutes = new Hono()
  // GET /api/auth/session
  .get("/session", (c) => {
    // Stub unauthenticated by default
    const response = {
      code: 0 as const,
      session: null as AuthSession | null,
      user: null as AuthUser | null,
      role: "user",
    }
    return c.json(response)
  })
