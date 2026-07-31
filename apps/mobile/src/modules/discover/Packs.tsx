import { cn } from "@follow/utils"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Image, Pressable, ScrollView, View } from "react-native"

import { Text } from "@/src/components/ui/typography/Text"

import type { StarterPack } from "./api"
import { DISCOVER_QUERY_STALE_TIME, fetchPacks, subscribePack } from "./api"
import { SectionHead } from "./SectionHead"

const FALLBACK_PACK_COLOR = "#8A8A8E"

/** Curated starter packs, shown as a horizontally scrolling card rail. */
export const Packs = () => {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ["packs"],
    queryFn: fetchPacks,
    staleTime: DISCOVER_QUERY_STALE_TIME,
    meta: {
      persist: true,
    },
  })

  if (!data || data.length === 0) {
    return null
  }

  return (
    <>
      <SectionHead className="px-6 pb-1 pt-6" title={t("discover.packs_subtitle")} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-6 pb-2 pt-3"
      >
        {data.map((pack) => (
          <PackCard key={pack.id} pack={pack} />
        ))}
      </ScrollView>
    </>
  )
}

const PackCard = ({ pack }: { pack: StarterPack }) => {
  const { t } = useTranslation()
  const color = pack.color || FALLBACK_PACK_COLOR
  const subscribe = useMutation({ mutationFn: () => subscribePack(pack.slug) })
  const followed = subscribe.isSuccess

  return (
    <View className="border-hairline w-[220px] overflow-hidden rounded-2xl border-opaque-separator/60 bg-secondary-system-grouped-background">
      <View className="h-[72px] justify-end p-3" style={{ backgroundColor: color }}>
        <View className="flex-row">
          {pack.previews.map((preview, index) => (
            <View
              key={preview.feedId}
              className="size-8 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white"
              style={{ marginLeft: index ? -8 : 0 }}
            >
              {preview.image ? (
                <Image source={{ uri: preview.image }} className="size-full" />
              ) : (
                <Text className="text-xs font-bold" style={{ color }}>
                  {(preview.title || "?").slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>

      <View className="flex-1 p-3.5">
        <Text className="text-[15px] font-bold text-label" numberOfLines={1}>
          {pack.name}
        </Text>
        <Text
          className="mt-1 min-h-[34px] text-[13px] leading-snug text-secondary-label"
          numberOfLines={2}
        >
          {pack.description}
        </Text>
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs font-medium text-secondary-label">
            {t("discover.pack_feed_count", { count: pack.feedCount })}
          </Text>
          <Pressable
            disabled={subscribe.isPending || followed}
            onPress={() => subscribe.mutate()}
            className={cn(
              "h-7 items-center justify-center rounded-full px-3.5",
              followed ? "bg-accent" : "bg-system-fill",
            )}
          >
            <Text className={cn("text-xs font-bold", followed ? "text-white" : "text-label")}>
              {followed ? t("discover.followed") : t("discover.follow_all")}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
