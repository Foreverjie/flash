/**
 * Users Routes
 * User profile and management endpoints
 */
import { zValidator } from "@hono/zod-validator"
import { eq } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { db, subscriptions, users } from "../db/index.js"
import { requireAdmin, requireAuth } from "../middleware/auth.js"
import { logger } from "../utils/logger.js"
import { sendError, sendNotFound, structuredSuccess } from "../utils/response.js"

// Route types
type UsersVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const usersRouter = new Hono<{ Variables: UsersVariables }>()

/**
 * GET /users/:id
 * Get user by ID (public profile)
 */
usersRouter.get("/:id", zValidator("param", z.object({ id: z.string().min(1) })), async (c) => {
  const { id } = c.req.valid("param")

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true,
      name: true,
      handle: true,
      bio: true,
      website: true,
      image: true,
      socialLinks: true,
      createdAt: true,
    },
  })

  if (!user) {
    return sendNotFound(c, "User")
  }

  return c.json(structuredSuccess({ user }))
})

/**
 * GET /users/:id/subscriptions
 * Get user's public subscriptions
 */
usersRouter.get(
  "/:id/subscriptions",
  zValidator("param", z.object({ id: z.string().min(1) })),
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().positive().max(100).default(20),
    }),
  ),
  async (c) => {
    const { id } = c.req.valid("param")
    const { page, limit } = c.req.valid("query")
    const offset = (page - 1) * limit

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    })

    if (!user) {
      return sendNotFound(c, "User")
    }

    // Get public subscriptions with feeds
    const userSubscriptions = await db.query.subscriptions.findMany({
      where: eq(subscriptions.userId, id),
      limit,
      offset,
      with: {
        feed: {
          columns: {
            id: true,
            title: true,
            url: true,
            description: true,
            image: true,
            siteUrl: true,
          },
        },
      },
    })

    // Filter out private subscriptions
    const publicSubscriptions = userSubscriptions.filter((sub) => !sub.isPrivate)

    return c.json(
      structuredSuccess({
        data: publicSubscriptions,
        page,
        limit,
        total: publicSubscriptions.length,
      }),
    )
  },
)

/**
 * GET /users/handle/:handle
 * Get user by handle
 */
usersRouter.get(
  "/handle/:handle",
  zValidator("param", z.object({ handle: z.string().min(1) })),
  async (c) => {
    const { handle } = c.req.valid("param")

    const user = await db.query.users.findFirst({
      where: eq(users.handle, handle),
      columns: {
        id: true,
        name: true,
        handle: true,
        bio: true,
        website: true,
        image: true,
        socialLinks: true,
        createdAt: true,
      },
    })

    if (!user) {
      return sendNotFound(c, "User")
    }

    return c.json(structuredSuccess({ user }))
  },
)

/**
 * GET /users (Admin only)
 * List all users with pagination
 */
usersRouter.get(
  "/",
  requireAuth,
  requireAdmin,
  zValidator(
    "query",
    z.object({
      page: z.coerce.number().positive().default(1),
      limit: z.coerce.number().positive().max(100).default(20),
      search: z.string().optional(),
    }),
  ),
  async (c) => {
    const { page, limit } = c.req.valid("query")
    const offset = (page - 1) * limit

    // Basic listing without search filter for now
    const allUsers = await db.query.users.findMany({
      limit,
      offset,
      columns: {
        id: true,
        email: true,
        name: true,
        handle: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    })

    // Get total count
    const totalUsers = await db.query.users.findMany()

    return c.json(
      structuredSuccess({
        data: allUsers,
        page,
        limit,
        total: totalUsers.length,
        hasMore: offset + limit < totalUsers.length,
      }),
    )
  },
)

/**
 * DELETE /users/:id (Admin only)
 * Delete a user
 */
usersRouter.delete(
  "/:id",
  requireAuth,
  requireAdmin,
  zValidator("param", z.object({ id: z.string().min(1) })),
  async (c) => {
    try {
      const { id } = c.req.valid("param")
      const currentUser = c.get("user")

      // Prevent self-deletion
      if (currentUser?.id === id) {
        return sendError(c, "Cannot delete your own account", 400, 400)
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
      })

      if (!user) {
        return sendNotFound(c, "User")
      }

      await db.delete(users).where(eq(users.id, id))

      logger.info(`[Users] User deleted: ${id} by admin ${currentUser?.id}`)

      return c.json(structuredSuccess({ message: "User deleted successfully" }))
    } catch (error) {
      logger.error("[Users] Delete error:", error)
      return sendError(c, "Failed to delete user", 500, 500)
    }
  },
)

export default usersRouter
