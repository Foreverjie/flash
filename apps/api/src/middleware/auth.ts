import type { Context, Next } from "hono"

import { supabase } from "../lib/supabase.js"
import { sendUnauthorized } from "../utils/response"

export interface AuthContext {
  userId: string
  email?: string
  role?: string
}

/**
 * Authentication middleware - verifies JWT token from Supabase
 * Requires valid authentication token in Authorization header
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendUnauthorized(c, "Missing or invalid authorization header")
  }

  const token = authHeader.replace("Bearer ", "")

  try {
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data.user) {
      return sendUnauthorized(c, "Invalid or expired token")
    }

    // Set user context
    c.set("userId", data.user.id)
    c.set("userEmail", data.user.email)
    c.set("userRole", data.user.role || "user")

    return await next()
  } catch (error) {
    console.error("Auth middleware error:", error)
    return sendUnauthorized(c, "Authentication failed")
  }
}

/**
 * Optional auth middleware - doesn't fail if no auth provided
 * But validates token if present
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization")

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "")

    try {
      const { data } = await supabase.auth.getUser(token)

      if (data.user) {
        c.set("userId", data.user.id)
        c.set("userEmail", data.user.email)
        c.set("userRole", data.user.role || "user")
      }
    } catch {
      // Silently ignore errors for optional auth
    }
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
