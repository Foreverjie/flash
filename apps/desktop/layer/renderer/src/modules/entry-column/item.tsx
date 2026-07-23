import { FeedViewType, isFreeRole } from "@follow/constants"
import { useEntry, useHasEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { useEntryTranslation, usePrefetchEntryTranslation } from "@follow/store/translation/hooks"
import { useUserRole } from "@follow/store/user/hooks"
import type { FC } from "react"
import { memo } from "react"

import { useActionLanguage, useGeneralSettingKey } from "~/atoms/settings/general"

import { getItemComponentByView } from "./Items/getItemComponentByView"
import { PropertyItem } from "./Items/property-item"
import { EntryItemWrapper } from "./layouts/EntryItemWrapper"
import type { EntryListItemFC } from "./types"

// Feed URL schemes whose entries render as Property Feed cards.
const PROPERTY_FEED_SCHEMES = ["leyoujia_community://", "qfang_community://"]

function useIsPropertyFeedEntry(entryId: string) {
  const feedId = useEntry(entryId, (e) => e.feedId)
  return (
    useFeedById(feedId, (feed) =>
      PROPERTY_FEED_SCHEMES.some((scheme) => feed.url?.startsWith(scheme)),
    ) ?? false
  )
}

interface EntryItemProps {
  entryId: string
  view: FeedViewType
  currentFeedTitle?: string
  isFirstItem?: boolean
}
const EntryItemImpl = memo(function EntryItemImpl({
  entryId,
  view,
  currentFeedTitle,
  isFirstItem,
}: EntryItemProps) {
  const enableTranslation = useGeneralSettingKey("translation")
  const actionLanguage = useActionLanguage()
  const userRole = useUserRole()
  const shouldPrefetchTranslation = enableTranslation && !isFreeRole(userRole)
  const translation = useEntryTranslation({
    entryId,
    language: actionLanguage,
    enabled: enableTranslation,
  })
  usePrefetchEntryTranslation({
    entryIds: [entryId],
    enabled: shouldPrefetchTranslation,
    language: actionLanguage,
    withContent: view === FeedViewType.SocialMedia,
  })

  const isPropertyFeed = useIsPropertyFeedEntry(entryId)
  const Item: EntryListItemFC = isPropertyFeed ? PropertyItem : getItemComponentByView(view)

  return (
    <EntryItemWrapper
      itemClassName={Item.wrapperClassName}
      entryId={entryId}
      view={view}
      isFirstItem={isFirstItem}
    >
      <Item entryId={entryId} translation={translation} currentFeedTitle={currentFeedTitle} />
    </EntryItemWrapper>
  )
})

export const EntryItem: FC<EntryItemProps> = memo(({ entryId, view, currentFeedTitle }) => {
  const hasEntry = useHasEntry(entryId)

  if (!hasEntry) return null
  return <EntryItemImpl entryId={entryId} view={view} currentFeedTitle={currentFeedTitle} />
})

export const EntryVirtualListItem = ({
  ref,
  entryId,
  view,
  className,
  currentFeedTitle,
  ...props
}: EntryItemProps &
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
    ref?: React.Ref<HTMLDivElement | null>
  }) => {
  const hasEntry = useHasEntry(entryId)

  if (!hasEntry) return <div ref={ref} {...props} style={undefined} />

  const isFirstItem = props["data-index"] === 0

  return (
    <div className="absolute left-0 top-0 w-full will-change-transform" ref={ref} {...props}>
      <EntryItemImpl
        entryId={entryId}
        view={view}
        currentFeedTitle={currentFeedTitle}
        isFirstItem={isFirstItem}
      />
    </div>
  )
}
