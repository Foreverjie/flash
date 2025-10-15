import type { Context, Next } from "hono"

import { sendUnauthorized } from "../utils/response"

/**
 * Mock authentication middleware
 * TODO: Implement real authentication with session validation
 */
export async function authMiddleware(c: Context, next: Next) {
  // For now, just pass through
  // In production, check for valid session/token
  const authHeader = c.req.header("Authorization")

  if (!authHeader) {
    // For development, we'll allow requests without auth
    // return sendUnauthorized(c)
  }

  // Mock user context
  c.set("userId", "mock-user-id")
  c.set("userRole", "user")

  await next()
}

/**
 * Optional auth middleware - doesn't fail if no auth provided
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (authHeader) {
    // Set user context if available
    c.set("userId", "mock-user-id")
    c.set("userRole", "user")
  }

  await next()
}

/**
 * Admin-only middleware
 */
export async function adminOnly(c: Context, next: Next) {
  const userRole = c.get("userRole")

  if (userRole !== "admin") {
    return sendUnauthorized(c, "Admin access required")
  }

  return await next()
}
