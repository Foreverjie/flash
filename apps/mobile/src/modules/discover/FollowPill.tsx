import { useIsSubscribed } from "@follow/store/subscription/hooks"
import { cn } from "@follow/utils"
import { useTranslation } from "react-i18next"
import { Pressable } from "react-native"

import { Text } from "@/src/components/ui/typography/Text"
import { useNavigation } from "@/src/lib/navigation/hooks"
import { FollowScreen } from "@/src/screens/(modal)/FollowScreen"

/** Follow / Following pill used across the Discover rows. */
export const FollowPill = ({ feedId, url }: { feedId?: string; url?: string | null }) => {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const navigation = useNavigation()
  const isSubscribed = useIsSubscribed(feedId ?? "")

  return (
    <Pressable
      className={cn(
        "h-7 shrink-0 items-center justify-center rounded-full px-3.5",
        isSubscribed ? "border-hairline border-opaque-separator" : "bg-accent",
      )}
      onPress={() => {
        if (feedId) {
          navigation.presentControllerView(FollowScreen, { id: feedId, type: "feed" })
        } else if (url) {
          navigation.presentControllerView(FollowScreen, { url, type: "url" })
        }
      }}
    >
      <Text
        className={cn("text-xs font-bold", isSubscribed ? "text-secondary-label" : "text-white")}
      >
        {isSubscribed ? t("discover.followed") : tCommon("words.follow")}
      </Text>
    </Pressable>
  )
}
