import { env } from "@follow/shared/env.desktop"
import { useSubscriptionStore } from "@follow/store/subscription/store"
import { useWhoami } from "@follow/store/user/hooks"
import { useQuery } from "@tanstack/react-query"

export interface SubscriptionUsage {
  used: number
  limit: number
}

const API_BASE = env.VITE_API_URL

async function fetchSubscriptionUsage(): Promise<SubscriptionUsage> {
  const res = await fetch(`${API_BASE}/api/v1/subscriptions/usage`, { credentials: "include" })
  if (!res.ok) throw new Error(`Failed to fetch subscription usage: ${res.status}`)
  const json = await res.json()
  return json.data
}

/**
 * Feeds subscribed vs. the account cap, for the sidebar meter.
 *
 * Re-runs whenever the local subscription count changes so following or
 * unfollowing updates the meter without waiting for the stale timer.
 */
export function useSubscriptionUsageQuery() {
  const user = useWhoami()
  const localCount = useSubscriptionStore((state) => state.subscriptionIdSet.size)

  return useQuery({
    queryKey: ["subscriptions", "usage", localCount],
    queryFn: fetchSubscriptionUsage,
    enabled: !!user,
    staleTime: 60 * 1000,
    retry: 1,
  })
}
