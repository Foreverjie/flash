import { env } from "@follow/shared/env.desktop"
import { useQuery } from "@tanstack/react-query"

import { defineQuery } from "~/lib/defineQuery"

export interface PostItem {
  id: string
  feedId: string
  guid: string
  title: string | null
  url: string | null
  description: string | null
  content: string | null
  author: string | null
  authorUrl: string | null
  authorAvatar: string | null
  publishedAt: string | null
  insertedAt: string | null
  categories: string[] | null
  media: Array<{
    url: string
    type: "image" | "video" | "audio"
    width?: number
    height?: number
  }> | null
  feedTitle: string | null
  feedSiteUrl: string | null
  feedImage: string | null
}

export interface PostsResponse {
  code: number
  data: {
    data: PostItem[]
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export interface PostDetailResponse {
  code: number
  data: {
    post: PostItem & {
      formattedContent: {
        html?: string
        markdown?: string
        text?: string
      } | null
      attachments: unknown[] | null
      language: string | null
      extra: Record<string, unknown> | null
    }
  }
}

const API_BASE = env.VITE_API_URL

async function fetchPosts(page: number, limit: number, feedId?: string): Promise<PostsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (feedId) params.set("feedId", feedId)
  const url = `${API_BASE}/api/v1/posts?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`)
  return res.json() as Promise<PostsResponse>
}

async function fetchPost(id: string): Promise<PostDetailResponse> {
  const url = `${API_BASE}/api/v1/posts/${id}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch post: ${res.status}`)
  return res.json() as Promise<PostDetailResponse>
}

export const postsQuery = {
  list: (page = 1, limit = 20, feedId?: string) =>
    defineQuery(["posts", "list", page, limit, feedId], async () => {
      const res = await fetchPosts(page, limit, feedId)
      return res.data
    }),

  detail: (id: string) =>
    defineQuery(["posts", "detail", id], async () => {
      const res = await fetchPost(id)
      return res.data.post
    }),
}

/**
 * Hook: fetch public posts timeline (no auth required)
 */
export function usePostsQuery(page = 1, limit = 20, feedId?: string) {
  const query = postsQuery.list(page, limit, feedId)
  return useQuery({
    queryKey: query.key,
    queryFn: query.fn,
  })
}

/**
 * Hook: fetch a single post detail (no auth required)
 */
export function usePostDetailQuery(id: string) {
  const query = postsQuery.detail(id)
  return useQuery({
    queryKey: query.key,
    queryFn: query.fn,
    enabled: !!id,
  })
}
