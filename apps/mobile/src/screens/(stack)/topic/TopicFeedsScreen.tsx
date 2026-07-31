import { formatNumber } from "@follow/utils"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Pressable, View } from "react-native"
import { useColor } from "react-native-uikit-colors"

import {
  NavigationBlurEffectHeaderView,
  SafeNavigationScrollView,
} from "@/src/components/layouts/views/SafeNavigationScrollView"
import { PlatformActivityIndicator } from "@/src/components/ui/loading/PlatformActivityIndicator"
import { Text } from "@/src/components/ui/typography/Text"
import { User3CuteReIcon } from "@/src/icons/user_3_cute_re"
import type { NavigationControllerView } from "@/src/lib/navigation/types"
import { DISCOVER_QUERY_STALE_TIME, fetchTopicFeeds } from "@/src/modules/discover/api"
import { FeedSummary } from "@/src/modules/discover/FeedSummary"

export const TopicFeedsScreen: NavigationControllerView<{
  slug: string
  label: string
  description?: string | null
}> = ({ slug, label, description }) => {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const labelColor = useColor("label")
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ["topics", "feeds", slug],
    queryFn: () => fetchTopicFeeds(slug),
    staleTime: DISCOVER_QUERY_STALE_TIME,
    meta: {
      persist: true,
    },
  })

  return (
    <SafeNavigationScrollView Header={<NavigationBlurEffectHeaderView title={label} />}>
      {!!description && (
        <Text className="px-6 pb-1 pt-3 text-sm text-secondary-label">{description}</Text>
      )}
      {isLoading ? (
        <View className="mt-16 flex items-center justify-center">
          <PlatformActivityIndicator />
        </View>
      ) : isError ? (
        <View className="mt-16 items-center justify-center gap-4 px-6">
          <View className="items-center gap-1">
            <Text className="text-center text-lg font-semibold text-label">
              {t("discover.topic_error")}
            </Text>
            <Text className="text-center text-secondary-label">
              {t("discover.topic_error_body")}
            </Text>
          </View>
          <Pressable className="rounded-full bg-accent px-5 py-2.5" onPress={() => refetch()}>
            <Text className="font-semibold text-white">{tCommon("retry")}</Text>
          </Pressable>
        </View>
      ) : data && data.length > 0 ? (
        <View className="mt-2">
          {data.map((feed) => (
            <FeedSummary
              key={feed.id}
              feed={feed}
              simple
              className="flex flex-1 flex-row items-center px-6 py-3"
            >
              {!!feed.subscriptionCount && (
                <View className="flex flex-row items-center gap-1 opacity-60">
                  <User3CuteReIcon width={14} height={14} color={labelColor} />
                  <Text className="text-sm text-text">{formatNumber(feed.subscriptionCount)}</Text>
                </View>
              )}
            </FeedSummary>
          ))}
        </View>
      ) : (
        <View className="mt-16 items-center justify-center gap-1 px-6">
          <Text className="text-center text-lg font-semibold text-label">
            {t("discover.topic_empty")}
          </Text>
          <Text className="text-center text-secondary-label">{t("discover.topic_empty_body")}</Text>
        </View>
      )}
    </SafeNavigationScrollView>
  )
}
