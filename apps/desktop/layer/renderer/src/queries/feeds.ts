import { env } from "@follow/shared/env.desktop"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { defineQuery } from "~/lib/defineQuery"

export interface FeedItem {
  id: string
  url: string
  title: string | null
  siteUrl: string | null
  description: string | null
  image: string | null
  language: string | null
  lastFetchedAt: string | null
  errorAt: string | null
  createdAt: string | null
  subscriptionCount?: number | null
}

export interface FeedsResponse {
  code: number
  data: {
    data: FeedItem[]
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export interface UserSubscription {
  feedId: string
}

const API_BASE = env.VITE_API_URL

async function fetchFeeds(page: number, limit: number): Promise<FeedsResponse> {
  const url = `${API_BASE}/api/v1/feeds?page=${page}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch feeds: ${res.status}`)
  return res.json() as Promise<FeedsResponse>
}

async function fetchUserSubscriptions(): Promise<UserSubscription[]> {
  const url = `${API_BASE}/api/v1/subscriptions`
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) return []
  const json = await res.json()
  return (json.data ?? []).map((s: { feedId: string }) => ({ feedId: s.feedId }))
}

export const feedsQuery = {
  list: (page = 1, limit = 200) =>
    defineQuery(["feeds", "list", page, limit], async () => {
      const res = await fetchFeeds(page, limit)
      return res.data
    }),
}

/**
 * Hook: fetch public feeds list (no auth required)
 */
export function usePublicFeedsQuery(page = 1, limit = 200) {
  const query = feedsQuery.list(page, limit)
  return useQuery({
    queryKey: query.key,
    queryFn: query.fn,
  })
}

/**
 * Hook: fetch user's subscribed feed IDs (authenticated)
 */
export function useUserSubscriptionsQuery(enabled = true) {
  return useQuery({
    queryKey: ["user", "subscriptions"],
    queryFn: fetchUserSubscriptions,
    enabled,
  })
}

/**
 * Hook: subscribe to a feed
 */
export function useSubscribeFeedMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feedId: string) => {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId }),
      })
      if (!res.ok) throw new Error(`Failed to subscribe: ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] })
      // Sync sidebar Zustand store (if SubscriptionColumn is mounted).
      // TanStack Query uses prefix matching by default (exact: false),
      // so this matches all ["subscription", view] keys.
      queryClient.invalidateQueries({ queryKey: ["subscription"] })
    },
  })
}

/**
 * Hook: unsubscribe from a feed
 */
export function useUnsubscribeFeedMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (feedId: string) => {
      const res = await fetch(`${API_BASE}/api/v1/subscriptions`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId }),
      })
      if (!res.ok) throw new Error(`Failed to unsubscribe: ${res.status}`)
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscription"] })
    },
  })
}
