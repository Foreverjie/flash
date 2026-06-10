import { env } from "@follow/shared/env.desktop"
import { useQuery } from "@tanstack/react-query"

export interface MeStatsData {
  readCount: number
  currentStreakDays: number
  longestStreakDays: number
  activeDays: number
  /** 0 = Sunday … 6 = Saturday, null when there is no activity yet. */
  busiestWeekday: number | null
  topFeed: { feedId: string; title: string | null; count: number } | null
  heatmap: { day: string; count: number }[]
}

const API_BASE = env.VITE_API_URL

async function fetchMeStats(): Promise<MeStatsData> {
  const res = await fetch(`${API_BASE}/api/v1/me/stats`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch me stats: ${res.status}`)
  const json = await res.json()
  return json.data
}

export function useMeStatsQuery(enabled = true) {
  return useQuery({
    queryKey: ["me", "stats"],
    queryFn: fetchMeStats,
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
