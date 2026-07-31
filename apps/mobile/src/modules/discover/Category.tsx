import { useQuery } from "@tanstack/react-query"
import { LinearGradient } from "expo-linear-gradient"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Pressable, StyleSheet, View } from "react-native"
import { useColor } from "react-native-uikit-colors"

import { Grid } from "@/src/components/ui/grid"
import { PlatformActivityIndicator } from "@/src/components/ui/loading/PlatformActivityIndicator"
import { Text } from "@/src/components/ui/typography/Text"
import { Grid2CuteReIcon } from "@/src/icons/grid_2_cute_re"
import { useNavigation } from "@/src/lib/navigation/hooks"
import { TopicFeedsScreen } from "@/src/screens/(stack)/topic/TopicFeedsScreen"

import type { DiscoverTopic } from "./api"
import { DISCOVER_QUERY_STALE_TIME, fetchTopics } from "./api"

const FALLBACK_TILE_COLOR = "#8A8A8E"

export const Category = () => {
  const { t } = useTranslation()
  const label = useColor("label")
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
      <View className="mt-4 flex-row items-center justify-between px-6 pb-1 pt-4">
        <View className="flex-row items-center gap-2">
          <Grid2CuteReIcon width={24} height={24} color={label} />
          <Text className="text-2xl font-bold leading-[1.1] text-label">
            {t("discover.topics_subtitle")}
          </Text>
        </View>
      </View>

      {isLoading ? (
        <View className="mt-5 flex h-12 items-center justify-center">
          <PlatformActivityIndicator />
        </View>
      ) : (
        <Grid columns={2} gap={12} className="p-4">
          {data!.map((topic) => (
            <TopicItem key={topic.id} topic={topic} />
          ))}
        </Grid>
      )}
    </>
  )
}

const TopicItem = memo(({ topic }: { topic: DiscoverTopic }) => {
  const navigation = useNavigation()
  const color = topic.color || FALLBACK_TILE_COLOR
  return (
    <Pressable
      className="overflow-hidden rounded-2xl"
      onPress={() => {
        navigation.pushControllerView(TopicFeedsScreen, {
          slug: topic.slug,
          label: topic.label,
          description: topic.description,
        })
      }}
    >
      <LinearGradient
        colors={[`${color}80`, color]}
        start={{
          x: 0,
          y: 0,
        }}
        end={{
          x: 0,
          y: 1,
        }}
        className="rounded-2xl p-4"
        style={styles.cardItem}
      >
        <View className="flex-1 justify-end">
          <Text className="text-xl font-bold text-white" numberOfLines={1}>
            {topic.label}
          </Text>
          {!!topic.description && (
            <Text className="mt-0.5 text-xs font-medium text-white/80" numberOfLines={1}>
              {topic.description}
            </Text>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  )
})
const styles = StyleSheet.create({
  cardItem: {
    aspectRatio: 16 / 9,
  },
})
