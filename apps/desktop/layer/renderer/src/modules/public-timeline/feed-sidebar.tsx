import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { cn } from "@follow/utils/utils"
import { memo, useCallback } from "react"

import type { FeedItem } from "~/queries/feeds"
import { usePublicFeedsQuery } from "~/queries/feeds"

/**
 * Left sidebar: list of all feeds from public API.
 * Clicking a feed filters the entry list by that feed.
 */
export function PublicFeedSidebar({
  selectedFeedId,
  onSelectFeed,
}: {
  selectedFeedId: string | null
  onSelectFeed: (feedId: string | null, feedTitle?: string) => void
}) {
  const { data, isLoading } = usePublicFeedsQuery()

  return (
    <div className="flex h-full flex-col">
      {/* "All" button */}
      <div className="px-2 py-1">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            !selectedFeedId
              ? "bg-theme-item-active font-semibold text-text"
              : "text-text-secondary hover:bg-theme-item-hover",
          )}
          onClick={() => onSelectFeed(null)}
        >
          <i className="i-mgc-rada-cute-re shrink-0" />
          <span className="truncate">All</span>
          {data && (
            <span className="ml-auto shrink-0 text-xs text-text-tertiary">{data.total}</span>
          )}
        </button>
      </div>

      {/* Feed list */}
      <ScrollArea.ScrollArea rootClassName="h-0 grow" viewportClassName="px-2">
        {isLoading ? (
          <FeedListSkeleton />
        ) : (
          <div className="space-y-0.5 pb-6">
            {data?.data.map((feed) => (
              <FeedRow
                key={feed.id}
                feed={feed}
                isSelected={selectedFeedId === feed.id}
                onSelect={onSelectFeed}
              />
            ))}
          </div>
        )}
      </ScrollArea.ScrollArea>
    </div>
  )
}

const FeedRow = memo(
  ({
    feed,
    isSelected,
    onSelect,
  }: {
    feed: FeedItem
    isSelected: boolean
    onSelect: (feedId: string | null, feedTitle?: string) => void
  }) => {
    const handleClick = useCallback(() => {
      onSelect(feed.id, feed.title ?? feed.url)
    }, [feed.id, feed.title, feed.url, onSelect])

    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
          isSelected
            ? "bg-theme-item-active font-medium text-text"
            : "text-text-secondary hover:bg-theme-item-hover",
        )}
        onClick={handleClick}
      >
        {feed.image ? (
          <img
            src={feed.image}
            alt=""
            className="size-4 shrink-0 rounded-sm object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-4 shrink-0 items-center justify-center rounded-sm bg-fill-tertiary">
            <i className="i-mgc-rss-cute-fi text-[8px] text-text-quaternary" />
          </div>
        )}
        <span className="min-w-0 truncate">{feed.title || feed.url}</span>
      </button>
    )
  },
)

function FeedListSkeleton() {
  return (
    <div className="space-y-1 px-2.5">
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
      <Skeleton className="h-7 w-full rounded-md" />
    </div>
  )
}
