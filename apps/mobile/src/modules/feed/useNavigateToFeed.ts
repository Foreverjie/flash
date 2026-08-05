import { useSubscriptionByFeedId } from "@follow/store/subscription/hooks"
import { useCallback } from "react"

import { useNavigation } from "@/src/lib/navigation/hooks"
import { selectFeed, selectTimeline } from "@/src/modules/screen/atoms"
import { FeedScreen } from "@/src/screens/(stack)/feeds/[feedId]/FeedScreen"

/**
 * Pushes the feed detail screen for `feedId`. FeedScreen reads its entry list
 * from the selected-feed atoms, so the selection has to be made before the
 * push — and the timeline follows the subscription's view when there is one.
 */
export function useNavigateToFeed(feedId: string | undefined | null) {
  const navigation = useNavigation()
  const subscription = useSubscriptionByFeedId(feedId)

  return useCallback(() => {
    if (!feedId) return
    if (typeof subscription?.view === "number") {
      selectTimeline({ type: "view", viewId: subscription.view })
    }
    selectFeed({ type: "feed", feedId })
    navigation.pushControllerView(FeedScreen, { feedId })
  }, [feedId, navigation, subscription?.view])
}
