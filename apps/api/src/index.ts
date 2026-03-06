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
import cronRouter from "./routes/cron.js"
import entriesRouter from "./routes/entries.js"
import feedsRouter from "./routes/feeds.js"
import healthRouter from "./routes/health.js"
import postsRouter from "./routes/posts.js"
import readsRouter from "./routes/reads.js"
import subscriptionsRouter from "./routes/subscriptions.js"
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
        "http://localhost:5173", // Desktop dev server (alt port)
        "http://localhost:2233", // Desktop dev server (default port)
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
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-app-platform",
      "x-app-version",
      "x-app-name",
      "x-app-dev",
      "x-client-id",
      "x-session-id",
      "x-token",
      "folo-referral-code",
      "cache-control",
      "user-agent",
    ],
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
// Also mount at /better-auth/* for client-sdk compatibility (sdk uses /better-auth prefix)
app.on(["POST", "GET"], "/better-auth/*", async (c) => {
  // Rewrite URL from /better-auth/* to /api/auth/* for Better Auth handler
  const url = new URL(c.req.url)
  url.pathname = url.pathname.replace(/^\/better-auth/, "/api/auth")
  const rewrittenRequest = new Request(url.toString(), c.req.raw)
  return auth.handler(rewrittenRequest)
})

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

// Post routes (public timeline)
app.route("/posts", postsRouter)
app.route("/api/v1/posts", postsRouter)

// Subscription routes
app.route("/subscriptions", subscriptionsRouter)
app.route("/api/v1/subscriptions", subscriptionsRouter)

// Entry routes (authenticated timeline)
app.route("/entries", entriesRouter)
app.route("/api/v1/entries", entriesRouter)

// Read status routes
app.route("/reads", readsRouter)
app.route("/api/v1/reads", readsRouter)

// Comment routes
app.route("/comments", commentsRouter)
app.route("/api/v1/comments", commentsRouter)

// Cron routes (scheduled tasks)
app.route("/cron", cronRouter)
app.route("/api/cron", cronRouter)

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
      posts: "/api/v1/posts",
      comments: "/api/v1/comments",
      cron: "/api/cron/sync-feeds",
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
