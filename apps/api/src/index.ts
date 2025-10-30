import "dotenv/config"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

import { setupDatabase } from "./db.js"
import { auth } from "./lib/auth.js"
import aiRouter from "./routes/ai.js"
import authRouter from "./routes/auth.js"
import entriesRouter from "./routes/entries.js"
import feedsRouter from "./routes/feeds.js"
import healthRouter from "./routes/health.js"
import listsRouter from "./routes/lists.js"

const app = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null
    session: typeof auth.$Infer.Session.session | null
  }
}>()

// Middleware
app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) {
    c.set("user", null)
    c.set("session", null)
    await next()
    return
  }
  c.set("user", session.user)
  c.set("session", session.session)
  await next()
})
app.use("*", logger())
app.use("*", cors())

app.use(
  "/api/auth/*", // or replace with "*" to enable cors for all routes
  cors({
    origin: "http://localhost:3001", // replace with your origin
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
)

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))

// API Routes
app.route("/health", healthRouter)
app.route("/auth", authRouter)
app.route("/feeds", feedsRouter)
app.route("/entries", entriesRouter)
app.route("/lists", listsRouter)
app.route("/ai", aiRouter)

// Root route
app.get("/", (c) => {
  return c.json({
    message: "Follow API",
    version: "0.1.0",
    endpoints: {
      health: "/health",
      auth: "/auth",
      feeds: "/feeds",
      entries: "/entries",
      lists: "/lists",
      ai: "/ai",
    },
  })
})

// Initialize and start server
async function startServer() {
  // Initialize database connection
  await setupDatabase()

  // Start server
  const port = Number(process.env.PORT) || 3001
  console.info(`Server is running on http://localhost:${port}`)

  serve({
    fetch: app.fetch,
    port,
  })
}

startServer().catch((error) => {
  console.error("Failed to start server:", error)
  throw error
})
