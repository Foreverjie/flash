/**
 * Me Routes
 * Aggregated, private stats about the authenticated user. Powers the
 * profile "Me" surface (stats row, streak banner, heatmap, highlights).
 */
import { count, desc, eq, gte, sql } from "drizzle-orm"
import { Hono } from "hono"

import type { User } from "../auth/index.js"
import { db, feeds, posts, readStatus } from "../db/index.js"
import { requireAuth } from "../middleware/auth.js"
import { structuredSuccess } from "../utils/response.js"

type MeVariables = {
  user: User | null
  session: { id: string; expiresAt: Date } | null
}

const meRouter = new Hono<{ Variables: MeVariables }>()

const HEATMAP_DAYS = 182 // ~26 weeks, matches the profile heatmap grid

/** Day key in UTC, e.g. "2026-06-10". */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Consecutive-day streaks from a set of active day keys. */
function computeStreaks(days: Set<string>): { current: number; longest: number } {
  if (days.size === 0) return { current: 0, longest: 0 }

  const sorted = [...days].sort()
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00Z`).getTime()
    const cur = new Date(`${sorted[i]}T00:00:00Z`).getTime()
    run = cur - prev === 86_400_000 ? run + 1 : 1
    if (run > longest) longest = run
  }

  // Current streak counts back from today (or yesterday, so an unread
  // morning doesn't zero it out mid-day).
  const today = dayKey(new Date())
  const yesterday = dayKey(new Date(Date.now() - 86_400_000))
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null
  let current = 0
  while (cursor && days.has(cursor)) {
    current += 1
    cursor = dayKey(new Date(new Date(`${cursor}T00:00:00Z`).getTime() - 86_400_000))
  }

  return { current, longest }
}

/**
 * GET /me/stats
 * Reading stats for the authenticated user:
 * read count, streaks, daily heatmap, busiest weekday and top feed.
 */
meRouter.get("/stats", requireAuth, async (c) => {
  const user = c.get("user")!

  const [readCountRows, allDays, heatmapRows, topFeedRows] = await Promise.all([
    // Total posts ever marked read
    db.select({ readCount: count() }).from(readStatus).where(eq(readStatus.userId, user.id)),

    // Every distinct active day (for streaks)
    db
      .selectDistinct({ day: sql<string>`to_char(${readStatus.readAt}, 'YYYY-MM-DD')` })
      .from(readStatus)
      .where(eq(readStatus.userId, user.id)),

    // Reads per day inside the heatmap window
    db
      .select({
        day: sql<string>`to_char(${readStatus.readAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(readStatus)
      .where(
        sql`${eq(readStatus.userId, user.id)} AND ${gte(
          readStatus.readAt,
          new Date(Date.now() - HEATMAP_DAYS * 86_400_000),
        )}`,
      )
      .groupBy(sql`to_char(${readStatus.readAt}, 'YYYY-MM-DD')`),

    // Most-read feed
    db
      .select({
        feedId: feeds.id,
        title: feeds.title,
        count: count(),
      })
      .from(readStatus)
      .innerJoin(posts, eq(posts.id, readStatus.postId))
      .innerJoin(feeds, eq(feeds.id, posts.feedId))
      .where(eq(readStatus.userId, user.id))
      .groupBy(feeds.id, feeds.title)
      .orderBy(desc(count()))
      .limit(1),
  ])

  const readCount = readCountRows[0]?.readCount ?? 0
  const daySet = new Set(allDays.map((r) => r.day))
  const { current, longest } = computeStreaks(daySet)

  // Busiest weekday (0 = Sunday) across the heatmap window
  const weekdayCounts = Array.from({ length: 7 }, () => 0)
  for (const row of heatmapRows) {
    const weekday = new Date(`${row.day}T00:00:00Z`).getUTCDay()
    weekdayCounts[weekday] = (weekdayCounts[weekday] ?? 0) + row.count
  }
  const busiestWeekday =
    heatmapRows.length > 0 ? weekdayCounts.indexOf(Math.max(...weekdayCounts)) : null

  return c.json(
    structuredSuccess({
      readCount,
      currentStreakDays: current,
      longestStreakDays: longest,
      activeDays: daySet.size,
      busiestWeekday,
      topFeed: topFeedRows[0] ?? null,
      heatmap: heatmapRows.map((r) => ({ day: r.day, count: r.count })),
    }),
  )
})

export default meRouter
