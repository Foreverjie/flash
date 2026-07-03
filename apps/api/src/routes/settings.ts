/**
 * Settings Routes
 * Per-user, per-tab settings sync used by desktop/mobile clients.
 *
 * Response shapes follow the @follow-app/client-sdk contract:
 *   GET /settings        → { code: 0, settings: Record<tab, payload>, updated: Record<tab, ISO> }
 *   PATCH /settings/:tab → { code: 0 }
 *
 * The `updated` map doubles as the new-user signal: clients treat an account
 * with no updated tabs as brand new (it drives the onboarding guide).
 */
import { and, eq } from "drizzle-orm"
import { Hono } from "hono"

import type { User } from "../auth/index.js"
import { db, userSettings } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"
import { generateSnowflakeId } from "../utils/id.js"
import { sendError } from "../utils/response.js"

type SettingsVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const TAB_PATTERN = /^[a-z][a-z-]{0,31}$/

const settingsRouter = new Hono<{ Variables: SettingsVariables }>()

settingsRouter.get("/", requireAuth, async (c) => {
  const user = c.get("user")!

  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, user.id))

  const settings: Record<string, Record<string, unknown>> = {}
  const updated: Record<string, string> = {}
  for (const row of rows) {
    settings[row.tab] = row.payload
    updated[row.tab] = row.updatedAt.toISOString()
  }

  // Plain (non-enveloped) success shape per SDK contract
  return c.json({ code: 0, settings, updated })
})

settingsRouter.patch("/:tab", requireAuth, async (c) => {
  const user = c.get("user")!
  const tab = c.req.param("tab")

  if (!TAB_PATTERN.test(tab)) {
    return sendError(c, "Invalid settings tab", 400, 400)
  }

  let payload: Record<string, unknown>
  try {
    payload = (await c.req.json()) as Record<string, unknown>
  } catch {
    return sendError(c, "Invalid JSON body", 400, 400)
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return sendError(c, "Settings payload must be an object", 400, 400)
  }
  // The SDK repeats the path param in the body; don't persist it
  delete payload.tab

  const existing = await db.query.userSettings.findFirst({
    where: and(eq(userSettings.userId, user.id), eq(userSettings.tab, tab)),
  })

  if (existing) {
    await db
      .update(userSettings)
      .set({ payload: { ...existing.payload, ...payload }, updatedAt: new Date() })
      .where(eq(userSettings.id, existing.id))
  } else {
    await db.insert(userSettings).values({
      id: generateSnowflakeId(),
      userId: user.id,
      tab,
      payload,
    })
  }

  return c.json({ code: 0 })
})

export default settingsRouter
