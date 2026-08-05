import { FeedViewType } from "@follow/constants"
import { useFeedById, usePrefetchFeed, usePrefetchFeedAnalytics } from "@follow/store/feed/hooks"
import { useSubscriptionByFeedId } from "@follow/store/subscription/hooks"
import { subscriptionSyncService } from "@follow/store/subscription/store"
import { formatNumber } from "@follow/utils"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Alert, Pressable, ScrollView, View } from "react-native"

import { RelativeDateTime } from "@/src/components/ui/datetime/RelativeDateTime"
import { FeedIcon } from "@/src/components/ui/icon/feed-icon"
import { BottomModal } from "@/src/components/ui/modal/BottomModal"
import { Text } from "@/src/components/ui/typography/Text"
import { AddCuteReIcon } from "@/src/icons/add_cute_re"
import { CheckCuteReIcon } from "@/src/icons/check_cute_re"
import { InformationCuteReIcon } from "@/src/icons/information_cute_re"
import { useNavigation } from "@/src/lib/navigation/hooks"
import { FollowScreen } from "@/src/screens/(modal)/FollowScreen"
import { useColor } from "@/src/theme/colors"

/** Readable ink for text sitting on the yellow brand accent. */
const ACCENT_FOREGROUND = "#1A1207"

/**
 * Identity hero for the feed detail screen: avatar, description, analytics,
 * the follow action, and a sheet with the rest of the feed's metadata.
 */
export function FeedDetailHeader({ feedId }: { feedId: string }) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const navigation = useNavigation()

  const feed = useFeedById(feedId)
  // The feed may not be in the store yet when arriving from Discover.
  usePrefetchFeed(feedId)
  usePrefetchFeedAnalytics(feedId)
  const subscription = useSubscriptionByFeedId(feedId)
  const isSubscribed = !!subscription

  const [infoVisible, setInfoVisible] = useState(false)

  const labelColor = useColor("label")

  const host = useMemo(() => {
    const raw = feed?.siteUrl || feed?.url
    if (!raw) return
    try {
      return new URL(raw).host
    } catch {
      return raw
    }
  }, [feed?.siteUrl, feed?.url])

  const onPressFollow = () => {
    if (!isSubscribed) {
      navigation.presentControllerView(FollowScreen, { id: feedId, type: "feed" })
      return
    }
    Alert.alert(t("operation.unfollow"), t("feed_detail.unfollow_confirm"), [
      { text: tCommon("words.cancel"), style: "cancel" },
      {
        text: t("operation.unfollow"),
        style: "destructive",
        onPress: () => {
          subscriptionSyncService.unsubscribe(feedId)
        },
      },
    ])
  }

  if (!feed) return null

  return (
    <View className="bg-system-background">
      <View className="border-b border-separator/60 p-4">
        <View className="flex-row items-start gap-3">
          <View className="size-[52px] overflow-hidden rounded-xl">
            <FeedIcon
              size={52}
              feed={{
                id: feed.id,
                title: feed.title,
                url: feed.url,
                image: feed.image,
                ownerUserId: feed.ownerUserId,
                siteUrl: feed.siteUrl ?? undefined,
                type: FeedViewType.Articles,
              }}
            />
          </View>
          <View className="flex-1 pt-0.5">
            <Text className="text-xl font-bold text-label" numberOfLines={2}>
              {feed.title}
            </Text>
            {!!host && (
              <Text className="mt-0.5 text-xs text-secondary-label" numberOfLines={1}>
                {host}
              </Text>
            )}
          </View>
        </View>

        {!!feed.description && (
          <Text className="mt-3 text-sm leading-5 text-secondary-label" numberOfLines={4}>
            {feed.description}
          </Text>
        )}

        <View className="mt-3 flex-row flex-wrap items-center gap-x-4 gap-y-1">
          {!!feed.subscriptionCount && (
            <Text className="text-xs text-secondary-label">
              <Text className="text-xs font-semibold text-label">
                {formatNumber(feed.subscriptionCount)}
              </Text>{" "}
              {tCommon("feed.follower", { count: feed.subscriptionCount })}
            </Text>
          )}
          {!!feed.updatesPerWeek && (
            <Text className="text-xs text-secondary-label">
              {tCommon("feed.entry_week", { count: feed.updatesPerWeek })}
            </Text>
          )}
        </View>

        <View className="mt-4 flex-row gap-2">
          <Pressable
            onPress={onPressFollow}
            className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${
              isSubscribed ? "border border-separator" : "bg-accent"
            }`}
          >
            {isSubscribed ? (
              <CheckCuteReIcon width={16} height={16} color={labelColor} />
            ) : (
              <AddCuteReIcon width={16} height={16} color={ACCENT_FOREGROUND} />
            )}
            <Text
              className="text-base font-semibold"
              style={{ color: isSubscribed ? labelColor : ACCENT_FOREGROUND }}
            >
              {isSubscribed ? t("feed_detail.following") : tCommon("words.follow")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setInfoVisible(true)}
            className="h-11 flex-row items-center gap-1.5 rounded-xl border border-separator px-4"
          >
            <InformationCuteReIcon width={16} height={16} color={labelColor} />
            <Text className="text-sm font-semibold text-label">{t("feed_detail.info")}</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row items-center gap-2 px-4 pb-1 pt-4">
        <Text className="text-[10px] font-semibold uppercase tracking-[1.6px] text-secondary-label">
          {t("feed_detail.latest")}
        </Text>
        <View className="h-px flex-1 bg-separator/60" />
        {!!feed.latestEntryPublishedAt && (
          <Text className="text-xs text-secondary-label">
            <RelativeDateTime date={feed.latestEntryPublishedAt} />
          </Text>
        )}
      </View>

      <FeedInfoSheet feedId={feedId} visible={infoVisible} onClose={() => setInfoVisible(false)} />
    </View>
  )
}

function FeedInfoSheet({
  feedId,
  visible,
  onClose,
}: {
  feedId: string
  visible: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const feed = useFeedById(feedId)
  const subscription = useSubscriptionByFeedId(feedId)

  const rows = useMemo(() => {
    const list: Array<{ key: string; label: string; value: React.ReactNode }> = []
    if (feed?.url) list.push({ key: "url", label: t("feed_detail.info_url"), value: feed.url })
    if (feed?.siteUrl)
      list.push({ key: "site", label: t("feed_detail.info_site"), value: feed.siteUrl })
    if (typeof feed?.subscriptionCount === "number") {
      list.push({
        key: "followers",
        label: t("feed_detail.info_followers"),
        value: formatNumber(feed.subscriptionCount),
      })
    }
    if (feed?.updatesPerWeek) {
      list.push({
        key: "cadence",
        label: t("feed_detail.info_cadence"),
        value: tCommon("feed.entry_week", { count: feed.updatesPerWeek }),
      })
    }
    if (feed?.latestEntryPublishedAt) {
      list.push({
        key: "updated",
        label: t("feed_detail.info_updated"),
        value: <RelativeDateTime date={feed.latestEntryPublishedAt} />,
      })
    }
    if (subscription?.category) {
      list.push({
        key: "category",
        label: t("feed_detail.info_category"),
        value: subscription.category,
      })
    }
    return list
  }, [feed, subscription, t, tCommon])

  return (
    <BottomModal visible={visible} onClose={onClose} className="max-h-[60%]">
      <View className="rounded-t-2xl bg-system-background px-4 pb-8 pt-2.5">
        <View className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-system-fill" />
        <Text className="text-base font-semibold text-label" numberOfLines={1}>
          {feed?.title}
        </Text>
        <ScrollView className="mt-2">
          {rows.map((row) => (
            <View
              key={row.key}
              className="flex-row justify-between gap-4 border-t border-separator/60 py-2.5"
            >
              <Text className="text-sm text-secondary-label">{row.label}</Text>
              <Text className="flex-1 text-right text-sm text-label" numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </BottomModal>
  )
}
