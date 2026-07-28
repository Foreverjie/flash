/**
 * Category routes retained for client SDK compatibility. Categories are
 * derived from subscriptions so a feed can belong to at most one category.
 */
import { zValidator } from "@hono/zod-validator"
import { and, eq, isNotNull } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import type { User } from "../auth/index.js"
import { db, subscriptions } from "../db/index.js"
import { isFeedView } from "../lib/feed-view.js"
import { requireAuth } from "../middleware/auth.js"
import {
  deleteUserFeedSubscriptions,
  normalizeCategory,
  updateUserFeedSubscriptions,
} from "../services/subscription-service.js"

type CategoriesVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const categoriesRouter = new Hono<{ Variables: CategoriesVariables }>()

const updateCategorySchema = z.object({
  feedIdList: z.array(z.string().min(1)).min(1).max(500),
  category: z.string().trim().min(1).max(100),
})

const deleteCategorySchema = z.object({
  feedIdList: z.array(z.string().min(1)).min(1).max(500),
  deleteSubscriptions: z.boolean(),
})

categoriesRouter.get("/", requireAuth, async (c) => {
  const user = c.get("user")
  if (!user) return c.json({ code: 0, data: [] })

  const rawView = c.req.query("view")
  const requestedView = rawView === undefined ? undefined : Number(rawView)
  if (requestedView !== undefined && requestedView !== -1 && !isFeedView(requestedView)) {
    return c.json({ code: 400, message: "Invalid feed view" }, 400)
  }

  const conditions = [eq(subscriptions.userId, user.id), isNotNull(subscriptions.category)]
  if (requestedView !== undefined && requestedView !== -1) {
    conditions.push(eq(subscriptions.view, requestedView))
  }

  const rows = await db
    .selectDistinct({ category: subscriptions.category })
    .from(subscriptions)
    .where(and(...conditions))
    .orderBy(subscriptions.category)

  return c.json({
    code: 0,
    data: rows.map((row) => row.category).filter((category): category is string => !!category),
  })
})

categoriesRouter.patch("/", requireAuth, zValidator("json", updateCategorySchema), async (c) => {
  const user = c.get("user")
  if (!user) return c.json({ code: 401, message: "Unauthorized" }, 401)

  const { feedIdList, category } = c.req.valid("json")
  await updateUserFeedSubscriptions({
    userId: user.id,
    feedIds: [...new Set(feedIdList)],
    data: { category: normalizeCategory(category) },
  })

  return c.json({ code: 0 })
})

categoriesRouter.delete("/", requireAuth, zValidator("json", deleteCategorySchema), async (c) => {
  const user = c.get("user")
  if (!user) return c.json({ code: 401, message: "Unauthorized" }, 401)

  const { feedIdList, deleteSubscriptions } = c.req.valid("json")
  const feedIds = [...new Set(feedIdList)]

  if (deleteSubscriptions) {
    await deleteUserFeedSubscriptions(user.id, feedIds)
  } else {
    await updateUserFeedSubscriptions({ userId: user.id, feedIds, data: { category: null } })
  }

  return c.json({ code: 0 })
})

export default categoriesRouter
