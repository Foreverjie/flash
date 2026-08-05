import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { useEntryTranslation } from "@follow/store/translation/hooks"
import { useAtomValue, useSetAtom } from "jotai"
import { use } from "react"
import { Pressable, View } from "react-native"
import { useColor } from "react-native-uikit-colors"

import { useActionLanguage, useGeneralSettingKey } from "@/src/atoms/settings/general"
import { UserAvatar } from "@/src/components/ui/avatar/UserAvatar"
import { FeedIcon } from "@/src/components/ui/icon/feed-icon"
import { Text } from "@/src/components/ui/typography/Text"
import { RightCuteReIcon } from "@/src/icons/right_cute_re"
import { EntryContentContext, useEntryContentContext } from "@/src/modules/entry-content/ctx"
import { useNavigateToFeed } from "@/src/modules/feed/useNavigateToFeed"

import { EntryTranslation } from "../entry-list/templates/EntryTranslation"

export const EntryTitle = ({ title, entryId }: { title: string; entryId: string }) => {
  const { showAITranslationAtom } = useEntryContentContext()
  const showTranslationOnce = useAtomValue(showAITranslationAtom)
  const enableTranslation = useGeneralSettingKey("translation") || showTranslationOnce
  const actionLanguage = useActionLanguage()
  const translation = useEntryTranslation({
    entryId,
    language: actionLanguage,
    enabled: enableTranslation,
  })
  const { titleHeightAtom } = use(EntryContentContext)
  const setTitleHeight = useSetAtom(titleHeightAtom)
  return (
    <View
      onLayout={(e) => {
        setTitleHeight(e.nativeEvent.layout.height)
      }}
    >
      <EntryTranslation
        className="px-5 text-title1 font-bold leading-snug text-label"
        source={title}
        target={translation?.title}
        bilingual
      />
    </View>
  )
}
export const EntrySocialTitle = ({ entryId }: { entryId: string }) => {
  const entry = useEntry(entryId, (entry) => {
    return {
      authorAvatar: entry.authorAvatar,
      author: entry.author,
      feedId: entry.feedId,
    }
  })
  const feed = useFeedById(entry?.feedId as string)
  const navigateToFeed = useNavigateToFeed(entry?.feedId)
  const secondaryLabelColor = useColor("secondaryLabel")
  return (
    // Nested inside the title's pressable: this wins the touch and opens the
    // feed instead of the post's source URL.
    <Pressable onPress={navigateToFeed} hitSlop={6} className="flex-row items-center gap-3 px-4">
      {entry?.authorAvatar ? (
        <UserAvatar size={28} name={entry?.author || ""} image={entry?.authorAvatar} />
      ) : (
        feed && <FeedIcon feed={feed} size={28} />
      )}
      <Text className="shrink text-[16px] font-semibold text-label" numberOfLines={1}>
        {entry?.author || feed?.title || ""}
      </Text>
      <RightCuteReIcon width={12} height={12} color={secondaryLabelColor} />
    </Pressable>
  )
}
