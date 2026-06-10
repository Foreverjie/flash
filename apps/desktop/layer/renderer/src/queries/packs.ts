import { env } from "@follow/shared/env.desktop"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface StarterPackPreview {
  feedId: string
  title: string | null
  image: string | null
  siteUrl: string | null
}

export interface StarterPack {
  id: string
  slug: string
  name: string
  description: string | null
  color: string | null
  feedCount: number
  previews: StarterPackPreview[]
}

const API_BASE = env.VITE_API_URL

async function fetchPacks(): Promise<StarterPack[]> {
  const res = await fetch(`${API_BASE}/api/v1/packs`)
  if (!res.ok) throw new Error(`Failed to fetch packs: ${res.status}`)
  const json = await res.json()
  return json.data ?? []
}

export function usePacksQuery() {
  return useQuery({ queryKey: ["packs"], queryFn: fetchPacks, staleTime: 10 * 60 * 1000 })
}

export function usePackSubscribeMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`${API_BASE}/api/v1/packs/${encodeURIComponent(slug)}/subscribe`, {
        method: "POST",
        credentials: "include",
      })
      if (!res.ok) throw new Error(`Failed to follow pack: ${res.status}`)
      return res.json() as Promise<{
        code: number
        data: { subscribed: number; alreadySubscribed: number }
      }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] })
      queryClient.invalidateQueries({ queryKey: ["subscription"] })
    },
  })
}
