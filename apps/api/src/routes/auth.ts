/**
 * Auth Routes
 * Better-auth integration with custom endpoints and zod validation
 */
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"

import { authClient } from "../auth/client.js"
import type { User } from "../auth/index.js"
import { auth } from "../auth/index.js"
import { requireAuth } from "../middleware/auth.js"
import { logger } from "../utils/logger.js"
import { sendError, structuredError, structuredSuccess } from "../utils/response.js"

// Validation schemas
const signUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100),
})

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  handle: z.string().min(3).max(50).regex(/^\w+$/).optional(),
  bio: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
  image: z.string().url().optional().or(z.literal("")),
})

// Route types
type AuthVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const authRouter = new Hono<{ Variables: AuthVariables }>()

/**
 * POST /auth/sign-up
 * Register a new user with email and password
 */
authRouter.post("/sign-up", zValidator("json", signUpSchema), async (c) => {
  try {
    const { email, password, name } = c.req.valid("json")

    const result = await authClient.signUp.email({
      email,
      password,
      name,
    })

    if (result.error) {
      return c.json(structuredError(result.error.message || "Sign up failed"), 400)
    }

    logger.info(`[Auth] New user registered: ${email}`)

    return c.json(
      structuredSuccess({
        user: result.data?.user
          ? {
              id: result.data.user.id,
              email: result.data.user.email,
              name: result.data.user.name,
            }
          : null,
        token: result.data?.token,
      }),
    )
  } catch (error) {
    logger.error("[Auth] Sign up error:", error)
    return sendError(c, "Failed to create account", 500, 500)
  }
})

/**
 * POST /auth/sign-in
 * Sign in with email and password
 */
authRouter.post("/sign-in", zValidator("json", signInSchema), async (c) => {
  try {
    const { email, password } = c.req.valid("json")

    const result = await authClient.signIn.email({
      email,
      password,
    })

    if (result.error) {
      return c.json(structuredError(result.error.message || "Invalid credentials"), 401)
    }

    logger.info(`[Auth] User signed in: ${email}`)

    return c.json(
      structuredSuccess({
        user: result.data?.user
          ? {
              id: result.data.user.id,
              email: result.data.user.email,
              name: result.data.user.name,
            }
          : null,
        token: result.data?.token,
      }),
    )
  } catch (error) {
    logger.error("[Auth] Sign in error:", error)
    return sendError(c, "Authentication failed", 500, 500)
  }
})

/**
 * POST /auth/sign-out
 * Sign out current user
 */
authRouter.post("/sign-out", async (c) => {
  try {
    await auth.api.signOut({ headers: c.req.raw.headers })

    return c.json(structuredSuccess({ message: "Signed out successfully" }))
  } catch (error) {
    logger.error("[Auth] Sign out error:", error)
    return sendError(c, "Sign out failed", 500, 500)
  }
})

/**
 * GET /auth/me
 * Get current authenticated user
 */
authRouter.get("/me", requireAuth, async (c) => {
  const user = c.get("user")

  return c.json(
    structuredSuccess({
      user: {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        image: user?.image,
        handle: user?.handle,
        bio: user?.bio,
        website: user?.website,
        role: user?.role,
        emailVerified: user?.emailVerified,
        createdAt: user?.createdAt,
      },
    }),
  )
})

/**
 * PATCH /auth/profile
 * Update current user's profile
 */
authRouter.patch("/profile", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
  try {
    const user = c.get("user")
    const updates = c.req.valid("json")

    if (!user) {
      return sendError(c, "User not found", 404, 404)
    }

    // Use Better-auth's update user API
    const result = await auth.api.updateUser({
      headers: c.req.raw.headers,
      body: updates,
    })

    if (!result) {
      return sendError(c, "Failed to update profile", 500, 500)
    }

    logger.info(`[Auth] Profile updated for user: ${user.id}`)

    return c.json(structuredSuccess({ user: result }))
  } catch (error) {
    logger.error("[Auth] Profile update error:", error)
    return sendError(c, "Failed to update profile", 500, 500)
  }
})

/**
 * POST /auth/forgot-password
 * Request password reset email
 */
authRouter.post(
  "/forgot-password",
  zValidator("json", z.object({ email: z.string().email() })),
  async (c) => {
    try {
      const { email } = c.req.valid("json")

      await auth.api.forgetPassword({
        body: { email, redirectTo: `${process.env.FRONTEND_URL}/reset-password` },
      })

      // Always return success to prevent email enumeration
      return c.json(
        structuredSuccess({ message: "If the email exists, a reset link will be sent" }),
      )
    } catch (error) {
      logger.error("[Auth] Forgot password error:", error)
      // Return success even on error to prevent enumeration
      return c.json(
        structuredSuccess({ message: "If the email exists, a reset link will be sent" }),
      )
    }
  },
)

/**
 * POST /auth/reset-password
 * Reset password with token
 */
authRouter.post(
  "/reset-password",
  zValidator(
    "json",
    z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    }),
  ),
  async (c) => {
    try {
      const { token, newPassword } = c.req.valid("json")

      await auth.api.resetPassword({
        body: { token, newPassword },
      })

      return c.json(structuredSuccess({ message: "Password reset successfully" }))
    } catch (error) {
      logger.error("[Auth] Password reset error:", error)
      return sendError(c, "Invalid or expired reset token", 400, 400)
    }
  },
)

export default authRouter
