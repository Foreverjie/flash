import { useQuery } from "@tanstack/react-query"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, View } from "react-native"

import { Grid } from "@/src/components/ui/grid"
import { PlatformActivityIndicator } from "@/src/components/ui/loading/PlatformActivityIndicator"
import { Text } from "@/src/components/ui/typography/Text"
import { useNavigation } from "@/src/lib/navigation/hooks"
import { TopicFeedsScreen } from "@/src/screens/(stack)/topic/TopicFeedsScreen"

import type { DiscoverTopic } from "./api"
import { DISCOVER_QUERY_STALE_TIME, fetchTopics } from "./api"
import { SectionHead } from "./SectionHead"

const FALLBACK_TILE_COLOR = "#8A8A8E"

export const Category = () => {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ["topics"],
    queryFn: fetchTopics,
    staleTime: DISCOVER_QUERY_STALE_TIME,
    meta: {
      persist: true,
    },
  })

  if (!isLoading && (!data || data.length === 0)) {
    return null
  }

  return (
    <>
      <SectionHead className="px-6 pb-1 pt-6" title={t("discover.topics_subtitle")} />

      {isLoading ? (
        <View className="mt-5 flex h-12 items-center justify-center">
          <PlatformActivityIndicator />
        </View>
      ) : (
        <Grid columns={2} gap={10} className="px-6 pt-3">
          {data!.map((topic) => (
            <TopicItem key={topic.id} topic={topic} />
          ))}
        </Grid>
      )}
    </>
  )
}

/** Full-colour topic tile with the highlight disc bleeding off the corner. */
const TopicItem = memo(({ topic }: { topic: DiscoverTopic }) => {
  const navigation = useNavigation()
  const color = topic.color || FALLBACK_TILE_COLOR

  return (
    <Pressable
      className="h-[86px] overflow-hidden rounded-[14px] p-3"
      style={{ backgroundColor: color }}
      onPress={() => {
        navigation.pushControllerView(TopicFeedsScreen, {
          slug: topic.slug,
          label: topic.label,
          description: topic.description,
        })
      }}
    >
      <View className="absolute -right-3.5 -top-3.5 size-16 rounded-full bg-white/20" />
      <View className="flex-1 justify-end">
        <Text className="text-[15px] font-bold text-white" numberOfLines={1}>
          {topic.label}
        </Text>
        {!!topic.description && (
          <Text className="mt-0.5 text-[11px] font-semibold text-white/85" numberOfLines={1}>
            {topic.description}
          </Text>
        )}
      </View>
    </Pressable>
  )
})
