// Shared building blocks + data hooks for the Me / profile surface
// (desktop canvas + mobile-web screen). Stats, streak, achievements and
// the activity heatmap read from GET /me/stats when available and fall
// back to presentational design values while loading or signed out.

import type { FeedModel } from "@follow/store/feed/types"
import type { TFunction } from "i18next"
import type { CSSProperties } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { useMeStatsQuery } from "~/queries/me"

export interface MeStat {
  id: string
  value: string
  label: string
  /** Renders a flame glyph + accent color (the reading streak). */
  accent?: boolean
}

export interface MeHighlight {
  id: string
  value: string
  label: string
}

export interface MeAchievement {
  id: string
  name: string
  desc: string
  /** `i-mgc-*` icon class. */
  icon: string
  /** Plate background color when unlocked. */
  color: string
  unlocked: boolean
  /** 0–1 completion for locked, in-progress achievements. */
  progress?: number
}

export interface MeSettingItem {
  id: string
  label: string
  sub: string
  icon: string
  to: string
}

/**
 * The Flash lightning bolt used as a background motif on the branded cover
 * and the dark streak banner.
 */
export function BoltMotif({
  size = 320,
  color = "var(--fo-a)",
  className,
  style,
}: {
  size?: number
  color?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className={className}
      style={style}
    >
      <path d="M37 6 L18 38 h13 L25 58 L46 24 h-13 Z" fill={color} />
    </svg>
  )
}

/** Fallback design values shown while stats load or when signed out. */
const FALLBACK_STREAK = 73
const FALLBACK_READ = 3914

export function useMeStats(feedCount: number, listCount: number): MeStat[] {
  const { t } = useTranslation()
  const { data } = useMeStatsQuery()
  const streak = data?.currentStreakDays ?? FALLBACK_STREAK
  const read = data?.readCount ?? FALLBACK_READ
  return useMemo(
    () => [
      { id: "feeds", value: String(feedCount), label: t("me.stats.feeds") },
      { id: "streak", value: String(streak), label: t("me.stats.streak"), accent: true },
      { id: "read", value: read.toLocaleString(), label: t("me.stats.read") },
      { id: "lists", value: String(listCount), label: t("me.stats.lists") },
    ],
    [feedCount, listCount, streak, read, t],
  )
}

/** Current reading streak + distance to the next (100-day) badge. */
export function useMeStreak(): { current: number; toNextBadge: number } {
  const { data } = useMeStatsQuery()
  const current = data?.currentStreakDays ?? FALLBACK_STREAK
  return { current, toNextBadge: Math.max(100 - current, 0) }
}

/** Localized weekday name ("Tuesdays") from a 0=Sunday index. */
function weekdayName(weekday: number, locale?: string): string {
  // 2026-06-07 is a known Sunday; offset to the target weekday.
  const date = new Date(Date.UTC(2026, 5, 7 + weekday))
  return new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(date)
}

export function useMeHighlights(): MeHighlight[] {
  const { t, i18n } = useTranslation()
  const { data } = useMeStatsQuery()
  return useMemo(
    () => [
      {
        id: "busiest",
        value:
          data?.busiestWeekday != null
            ? weekdayName(data.busiestWeekday, i18n.language)
            : t("me.highlights.busiest_value"),
        label: t("me.highlights.busiest"),
      },
      {
        id: "top",
        value: data?.topFeed?.title || t("me.highlights.top_value"),
        label: t("me.highlights.top"),
      },
      {
        id: "longest",
        value: data
          ? t("me.highlights.days", { count: data.longestStreakDays })
          : t("me.highlights.longest_value"),
        label: t("me.highlights.longest"),
      },
      {
        id: "read",
        value: data
          ? t("me.highlights.entries", { count: data.readCount })
          : t("me.highlights.words_value"),
        label: t("me.highlights.words"),
      },
    ],
    [data, i18n.language, t],
  )
}

export function useMeAchievements(feedCount = 0): MeAchievement[] {
  const { t } = useTranslation()
  const { data } = useMeStatsQuery()
  return useMemo(() => {
    const read = data?.readCount ?? FALLBACK_READ
    const streak = data?.longestStreakDays ?? FALLBACK_STREAK
    return [
      {
        id: "earlybird",
        name: t("me.achievements.earlybird.name"),
        desc: t("me.achievements.earlybird.desc"),
        icon: "i-mgc-time-cute-re",
        color: "#E8A33D",
        unlocked: true,
      },
      {
        id: "power",
        name: t("me.achievements.power.name"),
        desc: t("me.achievements.power.desc"),
        icon: "i-mgc-fire-cute-fi",
        color: "#E5484D",
        unlocked: read >= 1000,
        progress: Math.min(read / 1000, 1),
      },
      {
        id: "curator",
        name: t("me.achievements.curator.name"),
        desc: t("me.achievements.curator.desc"),
        icon: "i-mgc-bookmark-cute-re",
        color: "#D6409F",
        unlocked: true,
      },
      {
        id: "nightowl",
        name: t("me.achievements.nightowl.name"),
        desc: t("me.achievements.nightowl.desc"),
        icon: "i-mgc-star-cute-fi",
        color: "#6E56CF",
        unlocked: true,
      },
      {
        id: "century",
        name: t("me.achievements.century.name"),
        desc: t("me.achievements.century.desc"),
        icon: "i-mgc-trophy-cute-re",
        color: "#30A46C",
        unlocked: streak >= 100,
        progress: Math.min(streak / 100, 1),
      },
      {
        id: "explorer",
        name: t("me.achievements.explorer.name"),
        desc: t("me.achievements.explorer.desc"),
        icon: "i-mgc-compass-3-cute-re",
        color: "#10A2A2",
        unlocked: feedCount >= 100,
        progress: feedCount > 0 ? Math.min(feedCount / 100, 1) : 0.48,
      },
    ]
  }, [data, feedCount, t])
}

export function useMeSettings(email?: string | null): MeSettingItem[] {
  const { t } = useTranslation()
  return useMemo(
    () => [
      {
        id: "account",
        label: t("me.settings.account"),
        sub: email || t("me.settings.account_sub"),
        icon: "i-mgc-user-3-cute-re",
        to: "/settings/profile",
      },
      {
        id: "appearance",
        label: t("me.settings.appearance"),
        sub: t("me.settings.appearance_sub"),
        icon: "i-mgc-palette-cute-re",
        to: "/settings/appearance",
      },
      {
        id: "notifications",
        label: t("me.settings.notifications"),
        sub: t("me.settings.notifications_sub"),
        icon: "i-mgc-notification-cute-re",
        to: "/settings/notifications",
      },
      {
        id: "reading",
        label: t("me.settings.reading"),
        sub: t("me.settings.reading_sub"),
        icon: "i-mgc-book-6-cute-re",
        to: "/settings/general",
      },
      {
        id: "data",
        label: t("me.settings.data"),
        sub: t("me.settings.data_sub"),
        icon: "i-mgc-download-2-cute-re",
        to: "/settings/data-control",
      },
      {
        id: "import",
        label: t("me.settings.import"),
        sub: t("me.settings.import_sub"),
        icon: "i-mgc-file-import-cute-re",
        to: "/discover?type=import",
      },
      {
        id: "about",
        label: t("me.settings.about"),
        sub: t("me.settings.about_sub"),
        icon: "i-mgc-information-cute-re",
        to: "/settings/about",
      },
    ],
    [email, t],
  )
}

/** Five-step accent ramp for the GitHub-style reading heatmap. */
export const HEAT_COLORS = [
  "var(--fill-secondary, hsl(var(--background)))",
  "color-mix(in srgb, var(--fo-a) 35%, hsl(var(--background)))",
  "color-mix(in srgb, var(--fo-a) 60%, hsl(var(--background)))",
  "color-mix(in srgb, var(--fo-a) 85%, white)",
  "#FACC15",
]

/**
 * Deterministic weeks×7 reading-activity grid. Weekends are lighter and
 * recent weeks denser, so the heatmap reads like a real reading history.
 */
export function buildReadingHeatmap(weeks = 26): number[][] {
  const cells: number[][] = []
  let seed = 1337
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let w = 0; w < weeks; w++) {
    const col: number[] = []
    for (let d = 0; d < 7; d++) {
      const r = rnd()
      const recency = w / weeks
      const weekend = d === 0 || d === 6 ? 0.6 : 1
      const p = r * (0.55 + recency * 0.5) * weekend
      let lvl = 0
      if (p > 0.62) lvl = 4
      else if (p > 0.45) lvl = 3
      else if (p > 0.28) lvl = 2
      else if (p > 0.12) lvl = 1
      col.push(lvl)
    }
    cells.push(col)
  }
  return cells
}

/**
 * Weeks×7 heatmap levels + active-day count. Uses the real per-day read
 * counts from /me/stats when present, otherwise the deterministic design
 * grid so the surface still reads well while loading or signed out.
 */
export function useReadingHeatmap(weeks = 26): { grid: number[][]; activeDays: number } {
  const { data } = useMeStatsQuery()
  return useMemo(() => {
    if (!data || data.heatmap.length === 0) {
      return { grid: buildReadingHeatmap(weeks), activeDays: data?.activeDays ?? 182 }
    }

    const counts = new Map(data.heatmap.map((r) => [r.day, r.count]))
    const max = Math.max(...data.heatmap.map((r) => r.count))
    const level = (count: number) =>
      count === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((count / max) * 4)))

    // Build columns ending on the current week, days indexed 0=Sunday.
    const today = new Date()
    const grid: number[][] = []
    const lastSunday = new Date(today)
    lastSunday.setDate(today.getDate() - today.getDay())
    for (let w = weeks - 1; w >= 0; w--) {
      const col: number[] = []
      for (let d = 0; d < 7; d++) {
        const cell = new Date(lastSunday)
        cell.setDate(lastSunday.getDate() - w * 7 + d)
        if (cell > today) {
          col.push(0)
          continue
        }
        const key = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, "0")}-${String(
          cell.getDate(),
        ).padStart(2, "0")}`
        col.push(level(counts.get(key) ?? 0))
      }
      grid.push(col)
    }
    return { grid, activeDays: data.activeDays }
  }, [data, weeks])
}

/** Bare hostname for a feed, used as the subscription row subtitle. */
export function feedHost(feed?: FeedModel | null): string {
  const raw = feed?.siteUrl || feed?.url
  if (!raw) return ""
  try {
    return new URL(raw).hostname.replace(/^www\./, "")
  } catch {
    return (
      raw
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] ?? ""
    )
  }
}

/** A coarse cadence chip ("Daily" / "Weekly" / "Monthly") from updatesPerWeek. */
export function feedFrequencyLabel(feed: FeedModel | null | undefined, t: TFunction): string {
  const perWeek = feed?.updatesPerWeek ?? 0
  if (perWeek >= 5) return t("me.frequency.daily")
  if (perWeek >= 1) return t("me.frequency.weekly")
  return t("me.frequency.monthly")
}

/** Formats a "Joined <Month Year>" string from an ISO/date string. */
export function formatJoined(createdAt: string | Date | null | undefined, t: TFunction): string {
  if (!createdAt) return ""
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return ""
  return t("me.joined", {
    date: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  })
}
