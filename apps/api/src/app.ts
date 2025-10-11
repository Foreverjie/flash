import { Hono } from "hono"

import { authRoutes } from "./modules/auth"
import { entriesRoutes } from "./modules/entries"
import { feedsRoutes } from "./modules/feeds"
import { readsRoutes } from "./modules/reads"
import { rsshubRoutes } from "./modules/rsshub"
import { statusRoutes } from "./modules/status"
import { subscriptionsRoutes } from "./modules/subscriptions"

export function createApp() {
  const app = new Hono()

  // Health + root
  app.get("/", (c) => c.text("Follow API (Hono)"))
  app.get("/health", (c) => c.json({ ok: true }))

  // API namespace
  app.route("/api/auth", authRoutes)
  app.route("/api/status", statusRoutes)
  app.route("/api/reads", readsRoutes)
  app.route("/api/subscriptions", subscriptionsRoutes)
  app.route("/api/entries", entriesRoutes)
  app.route("/api/feeds", feedsRoutes)
  app.route("/api/rsshub", rsshubRoutes)

  return app
}
