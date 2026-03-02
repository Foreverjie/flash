import { env } from "@follow/shared/env.desktop"
import { useQuery } from "@tanstack/react-query"

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

const API_BASE = env.VITE_API_URL

async function fetchFeeds(page: number, limit: number): Promise<FeedsResponse> {
  const url = `${API_BASE}/api/v1/feeds?page=${page}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch feeds: ${res.status}`)
  return res.json() as Promise<FeedsResponse>
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
