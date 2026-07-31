import { followClient } from "@/src/lib/api-client"
import { proxyEnv } from "@/src/lib/proxy-env"

export const DISCOVER_QUERY_STALE_TIME = 10 * 60 * 1000

export const fetchFeedTrending = ({
  lang,
  view,
  limit,
}: {
  lang?: "eng" | "cmn"
  view?: number
  limit: number
}) => {
  return followClient.api.trending.getFeeds({
    language: lang,
    view,
    limit,
  })
}

export type DiscoverTopic = {
  id: string
  slug: string
  label: string
  description: string | null
  color: string | null
  sortOrder: number | null
}

export type TopicFeed = {
  id: string
  url: string
  title: string | null
  siteUrl: string | null
  description: string | null
  image: string | null
  subscriptionCount?: number | null
}

export const fetchTopics = async (): Promise<DiscoverTopic[]> => {
  const res = await fetch(`${proxyEnv.API_URL}/api/v1/topics`)
  if (!res.ok) {
    throw new Error(`Failed to fetch topics: ${res.status}`)
  }
  const json = await res.json()
  return json.data ?? []
}

export const fetchTopicFeeds = async (slug: string): Promise<TopicFeed[]> => {
  const res = await fetch(`${proxyEnv.API_URL}/api/v1/topics/${encodeURIComponent(slug)}/feeds`)
  if (!res.ok) {
    throw new Error(`Failed to fetch topic feeds: ${res.status}`)
  }
  const json = await res.json()
  return json.data ?? []
}
