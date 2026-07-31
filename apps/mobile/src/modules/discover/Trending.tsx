import { FeedViewType } from "@follow/constants"
import { cn, formatNumber } from "@follow/utils"
import type { TrendingFeedItem } from "@follow-app/client-sdk"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { View } from "react-native"
import { useColor } from "react-native-uikit-colors"

import { useUISettingKey } from "@/src/atoms/settings/ui"
import { FeedIcon } from "@/src/components/ui/icon/feed-icon"
import { PlatformActivityIndicator } from "@/src/components/ui/loading/PlatformActivityIndicator"
import { ItemPressableStyle } from "@/src/components/ui/pressable/enum"
import { ItemPressable } from "@/src/components/ui/pressable/ItemPressable"
import { Text } from "@/src/components/ui/typography/Text"
import { FilterCuteReIcon } from "@/src/icons/filter_cute_re"
import { useNavigation } from "@/src/lib/navigation/hooks"
import { DiscoverSettingsScreen } from "@/src/screens/(modal)/DiscoverSettingsScreen"
import { FeedScreen } from "@/src/screens/(stack)/feeds/[feedId]/FeedScreen"

import { selectFeed, selectTimeline } from "../screen/atoms"
import { fetchFeedTrending } from "./api"
import { FollowPill } from "./FollowPill"
import { SectionHead } from "./SectionHead"

export const Trending = ({
  className,
  itemClassName,
}: {
  className?: string
  itemClassName?: string
}) => {
  const { t } = useTranslation()
  const label = useColor("label")
  const discoverLanguage = useUISettingKey("discoverLanguage")
  const { data, isLoading } = useQuery({
    queryKey: ["trending", "feeds", discoverLanguage],
    queryFn: () =>
      fetchFeedTrending({
        lang: discoverLanguage === "all" ? undefined : discoverLanguage,
        limit: 20,
      }).then((res) => res.data),
    meta: {
      persist: true,
    },
  })
  const navigation = useNavigation()

  return (
    <View className={className}>
      <SectionHead
        className={cn("pb-1 pt-4", itemClassName)}
        title={t("discover.trending_subtitle")}
        action={
          <ItemPressable
            className="rounded-lg p-1"
            itemStyle={ItemPressableStyle.UnStyled}
            onPress={() => {
              navigation.presentControllerView(DiscoverSettingsScreen)
            }}
          >
            <FilterCuteReIcon width={20} height={20} color={label} />
          </ItemPressable>
        }
      />

      <View className="mt-1">
        {isLoading ? (
          <View className="mt-5 flex h-12 items-center justify-center">
            <PlatformActivityIndicator />
          </View>
        ) : (
          data?.map((item, index) => (
            <TrendingRow
              key={item.feed?.id || index}
              item={item}
              rank={index + 1}
              className={itemClassName}
            />
          ))
        )}
      </View>
    </View>
  )
}

/** One leaderboard row: rank, favicon, title + reader count, follow pill. */
const TrendingRow = ({
  item,
  rank,
  className,
}: {
  item: TrendingFeedItem
  rank: number
  className?: string
}) => {
  const { t: tCommon } = useTranslation("common")
  const navigation = useNavigation()
  const { feed } = item
  const followers = item.analytics?.subscriptionCount

  return (
    <View
      className={cn(
        "border-b-hairline flex-row items-center gap-3 border-opaque-separator/60 py-2.5",
        className,
      )}
    >
      <Text
        className={cn(
          "w-5 text-center text-base font-bold",
          rank <= 3 ? "text-accent" : "text-quaternary-label",
        )}
      >
        {rank}
      </Text>

      <ItemPressable
        itemStyle={ItemPressableStyle.UnStyled}
        className="min-w-0 flex-1 flex-row items-center gap-3"
        onPress={() => {
          if (!feed?.id) return
          if (typeof item.analytics?.view === "number") {
            selectTimeline({ type: "view", viewId: item.analytics.view })
          }
          selectFeed({ type: "feed", feedId: feed.id })
          navigation.pushControllerView(FeedScreen, { feedId: feed.id })
        }}
      >
        <View className="size-[38px] overflow-hidden rounded-[9px]">
          <FeedIcon
            size={38}
            feed={{
              id: feed.id!,
              title: feed.title!,
              url: feed.url!,
              image: feed.image!,
              ownerUserId: feed.ownerUserId!,
              siteUrl: feed.siteUrl!,
              type: FeedViewType.Articles,
            }}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-label" numberOfLines={1}>
            {feed?.title}
          </Text>
          {!!followers && (
            <Text className="mt-0.5 text-xs text-secondary-label" numberOfLines={1}>
              {formatNumber(followers)} {tCommon("feed.follower", { count: followers })}
            </Text>
          )}
        </View>
      </ItemPressable>

      <FollowPill feedId={feed?.id} url={feed?.url} />
    </View>
  )
}
