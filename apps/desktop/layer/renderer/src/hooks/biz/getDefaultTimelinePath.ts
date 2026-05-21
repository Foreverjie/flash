import { FeedViewType } from "@follow/constants"
import { useSubscriptionStore } from "@follow/store/subscription/store"

import { getUISettings } from "~/atoms/settings/ui"
import { ROUTE_ENTRY_PENDING, ROUTE_FEED_PENDING, ROUTE_VIEW_ALL } from "~/constants"

import { computeTimelineTabLists } from "./useTimelineList"

export const getDefaultTimelinePath = () => {
  const uiSettings = getUISettings()
  const subscriptionState = useSubscriptionStore.getState()

  const hasAudiosSubscription =
    subscriptionState.feedIdByView[FeedViewType.Audios].size > 0 ||
    subscriptionState.listIdByView[FeedViewType.Audios].size > 0

  const hasNotificationsSubscription =
    subscriptionState.feedIdByView[FeedViewType.Notifications].size > 0 ||
    subscriptionState.listIdByView[FeedViewType.Notifications].size > 0

  const { visible } = computeTimelineTabLists({
    timelineTabs: uiSettings.timelineTabs,
    hasAudiosSubscription,
    hasNotificationsSubscription,
  })

  const firstTimeline = visible[0] ?? ROUTE_VIEW_ALL
  return `/timeline/${firstTimeline}/${ROUTE_FEED_PENDING}/${ROUTE_ENTRY_PENDING}`
}
