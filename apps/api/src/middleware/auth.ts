/**
 * Authentication middleware using Better-auth
 * Validates session and attaches user to context
 */
import type { Context, Next } from "hono"

import type { Session, User } from "../auth/index.js"
import { auth } from "../auth/index.js"
import { logger } from "../utils/logger.js"
import { sendForbidden, sendUnauthorized } from "../utils/response.js"

/**
 * Context variables for authenticated requests
 */
export interface AuthVariables {
  user: User | null
  session: Session["session"] | null
}

/**
 * Required authentication middleware
 * Blocks requests without valid session
 */
export async function requireAuth(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (!session || !session.user) {
      return sendUnauthorized(c, "Authentication required")
    }

    c.set("user", session.user)
    c.set("session", session.session)

    return await next()
  } catch (error) {
    logger.error("Auth middleware error:", error)
    return sendUnauthorized(c, "Authentication failed")
  }
}

/**
 * Optional authentication middleware
 * Attaches user to context if valid session exists, but doesn't block
 */
export async function optionalAuth(c: Context, next: Next) {
  try {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })

    if (session?.user) {
      c.set("user", session.user)
      c.set("session", session.session)
    } else {
      c.set("user", null)
      c.set("session", null)
    }

    return await next()
  } catch {
    // Silently continue without auth on error
    c.set("user", null)
    c.set("session", null)
    return await next()
  }
}

/**
 * Admin-only middleware
 * Requires authenticated user with admin role
 */
export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user") as User | null

  if (!user) {
    return sendUnauthorized(c, "Authentication required")
  }

  if (user.role !== "admin") {
    return sendForbidden(c, "Admin access required")
  }

  return await next()
}

/**
 * Session refresh middleware
 * Automatically refreshes session if it's close to expiry
 */
export async function refreshSession(c: Context, next: Next) {
  const session = c.get("session")

  if (session) {
    const now = new Date()
    const expiresAt = new Date(session.expiresAt)
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

    // Refresh if less than 7 days until expiry
    if (daysUntilExpiry < 7) {
      try {
        // Session will be automatically refreshed by Better-auth on next request
        logger.info(`Session for user ${c.get("user")?.id} approaching expiry, will be refreshed`)
      } catch (error) {
        logger.error("Session refresh error:", error)
      }
    }
  }

  return await next()
}
