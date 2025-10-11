import { Hono } from "hono"

import { ok } from "../types"

export const subscriptionsRoutes = new Hono()
  // GET /api/subscriptions
  .get("/", (c) => c.json(ok([])))
  // POST /api/subscriptions
  .post("/", async (c) => {
    // Accept a minimal payload and return stubbed creation
    const _body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    return c.json({ code: 0 as const, feed: null, list: null, unread: {} })
  })
