import { env } from "@follow/shared/env.desktop"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { FeedItem } from "./feeds"

export interface Topic {
  id: string
  slug: string
  label: string
  description: string | null
  color: string | null
  sortOrder: number | null
}

const API_BASE = env.VITE_API_URL

async function fetchTopics(): Promise<Topic[]> {
  const res = await fetch(`${API_BASE}/api/v1/topics`)
  if (!res.ok) throw new Error(`Failed to fetch topics: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

async function fetchTopicFeeds(slug: string): Promise<FeedItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/topics/${encodeURIComponent(slug)}/feeds`)
  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

export function useTopicsQuery() {
  return useQuery({ queryKey: ["topics"], queryFn: fetchTopics })
}

export function useFeedsForTopicsQuery(slugs: string[]) {
  // Single-shot: fetches each topic's feeds and merges, deduped by feed id.
  const key = ["topics", "feeds", [...slugs].sort().join(",")]
  return useQuery({
    queryKey: key,
    enabled: slugs.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(slugs.map((s) => fetchTopicFeeds(s)))
      const seen = new Map<string, FeedItem>()
      for (const list of lists) {
        for (const f of list) if (!seen.has(f.id)) seen.set(f.id, f)
      }
      return [...seen.values()]
    },
  })
}

export function useOnboardingSubscribeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { feedIds: string[]; topicSlugs?: string[] }) => {
      const res = await fetch(`${API_BASE}/api/v1/topics/onboarding/subscribe`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error(`Failed to subscribe: ${res.status}`)
      return res.json() as Promise<{
        code: number
        data: { subscribed: number; alreadySubscribed?: number }
      }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscription"] })
      // Refetch timeline entries: any fetch that ran before these
      // subscriptions existed is cached as empty for the current view.
      queryClient.invalidateQueries({ queryKey: ["entries"] })
    },
  })
}
