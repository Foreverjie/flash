import { getEntry } from "@follow/store/entry/getter"
import { useEntryIdsByFeedId, useEntryIdsByView } from "@follow/store/entry/hooks"
import { useEntryStore } from "@follow/store/entry/store"
import type { FC } from "react"
import { useMemo } from "react"

import { useRouteParamsSelector } from "~/hooks/biz/useRouteParams"
import { useAIChatStore } from "~/modules/ai-chat/store/AIChatContext"

import type { PickerItem } from "./PickerList"
import { PickerList } from "./PickerList"

export const CurrentFeedEntriesPickerList: FC<{ onSelect: (entryId: string) => void }> = ({
  onSelect,
}) => {
  const mainFeedId = useAIChatStore()((s) => {
    const mainFeedBlock = s.blocks.find((b) => b.type === "mainFeed")
    const mainEntryBlock = s.blocks.find((b) => b.type === "mainEntry")
    return mainFeedBlock && mainFeedBlock.type === "mainFeed"
      ? mainFeedBlock.value
      : mainEntryBlock && mainEntryBlock.type === "mainEntry"
        ? getEntry(mainEntryBlock.value)?.feedId
        : null
  })
  const entryIds = useEntryIdsByFeedId(mainFeedId)

  return <BaseEntryPickerList items={entryIds || []} onSelect={onSelect} />
}

export const RecentEntriesPickerList: FC<{ onSelect: (entryId: string) => void }> = ({
  onSelect,
}) => {
  const view = useRouteParamsSelector((route) => route.view)
  const recentEntryIds = useEntryIdsByView(view, false)

  return <BaseEntryPickerList items={(recentEntryIds || []).slice(0, 20)} onSelect={onSelect} />
}

const BaseEntryPickerList: FC<{ items: string[]; onSelect: (entryId: string) => void }> = ({
  items,
  onSelect,
}) => {
  const entryStore = useEntryStore((state) => state.data)
  const entries = useMemo(() => {
    return items
      .map((entryId) => {
        const entry = entryStore[entryId]
        return entry ? { id: entryId, title: entry.title || "Untitled" } : null
      })
      .filter(Boolean) as PickerItem[]
  }, [items, entryStore])

  return (
    <PickerList
      items={entries}
      placeholder="Search entries..."
      onSelect={onSelect}
      noResultsText="No entries found"
    />
  )
}
