/**
 * Follow API - Entry Point
 * Hono server with Vercel adapter support
 */
import "dotenv/config"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger as honoLogger } from "hono/logger"

import { auth } from "./auth/index.js"
import type { AuthVariables } from "./middleware/auth.js"
import { optionalAuth } from "./middleware/auth.js"
import authRouter from "./routes/auth.js"
import commentsRouter from "./routes/comments.js"
import feedsRouter from "./routes/feeds.js"
import healthRouter from "./routes/health.js"
import usersRouter from "./routes/users.js"
import { logger } from "./utils/logger.js"

// App type with auth variables
type AppVariables = AuthVariables

const app = new Hono<{ Variables: AppVariables }>()

// ============================================================
// Global Middleware
// ============================================================

// Request logging
app.use("*", honoLogger())

// CORS configuration
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow requests from these origins
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        process.env.FRONTEND_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
      ].filter(Boolean) as string[]

      if (!origin || allowedOrigins.includes(origin)) {
        return origin || "*"
      }

      // Allow subdomains of vercel.app
      if (origin.endsWith(".vercel.app")) {
        return origin
      }

      return null
    },
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 600,
    credentials: true,
  }),
)

// Optional auth for all routes (populates user context if authenticated)
app.use("*", optionalAuth)

// ============================================================
// Better-auth Handler
// ============================================================

// Mount Better-auth handler for all auth operations
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))

// ============================================================
// API Routes
// ============================================================

// Health check
app.route("/health", healthRouter)
app.route("/api/health", healthRouter)

// Auth routes (custom endpoints)
app.route("/auth", authRouter)
app.route("/api/v1/auth", authRouter)

// User routes
app.route("/users", usersRouter)
app.route("/api/v1/users", usersRouter)

// Feed routes
app.route("/feeds", feedsRouter)
app.route("/api/v1/feeds", feedsRouter)

// Comment routes
app.route("/comments", commentsRouter)
app.route("/api/v1/comments", commentsRouter)

// ============================================================
// Root Route
// ============================================================

app.get("/", (c) => {
  return c.json({
    name: "Follow API",
    version: "0.2.0",
    description: "RSS reader and social platform API",
    endpoints: {
      health: "/health",
      auth: "/api/auth/*",
      authCustom: "/api/v1/auth",
      users: "/api/v1/users",
      feeds: "/api/v1/feeds",
      comments: "/api/v1/comments",
    },
    documentation: "https://docs.follow.app/api",
  })
})

// ============================================================
// Error Handler
// ============================================================

app.onError((err, c) => {
  logger.error("Unhandled error:", err)

  return c.json(
    {
      code: 500,
      message: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    },
    500,
  )
})

// 404 Handler
app.notFound((c) => {
  return c.json(
    {
      code: 404,
      message: "Not found",
    },
    404,
  )
})

// ============================================================
// Server Start (for local development)
// ============================================================

// Only start server when not in Vercel environment
if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 3001

  logger.info(`Starting server on http://localhost:${port}`)

  serve({
    fetch: app.fetch,
    port,
  })
}

// ============================================================
// Export for Vercel
// ============================================================

// Export the Hono app for Vercel serverless functions
export default app

// Named exports for different Vercel configurations
export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const PATCH = app.fetch
export const DELETE = app.fetch
export const OPTIONS = app.fetch
