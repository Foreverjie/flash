import { Hono } from "hono"

import { ok } from "../types"

export const readsRoutes = new Hono()
  // GET /api/reads/total-count
  .get("/total-count", (c) => c.json(ok({ count: 0 })))
  // GET /api/reads
  .get("/", (c) => {
    // Return a minimal map of read counts keyed by feed/list/etc.
    return c.json(ok<Record<string, number>>({}))
  })
