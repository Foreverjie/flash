import type { FeedViewType } from "@follow/constants"
import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import type { FeedModel } from "@follow/store/feed/types"
import { cn } from "@follow/utils/utils"
import { memo, useMemo } from "react"
import { useTranslation } from "react-i18next"

import { RelativeTime } from "~/components/ui/datetime"
import { FeedIcon } from "~/modules/feed/feed-icon"
import { resolvePropertyListing } from "~/modules/property/property-utils"

import { ArticleCardContent } from "./ArticleCard"
import { getCardType } from "./getCardType"
import { ImageCardContent } from "./ImageCard"
import { PodcastCardContent } from "./PodcastCard"
import { PropertyCard } from "./PropertyCard"
import { VideoCardContent } from "./VideoCard"

interface EntryCardProps {
  entryId: string
  /** View that decides which card body is rendered. */
  view: FeedViewType
  onOpen: (entryId: string) => void
  /**
   * Feed detail already names the feed in its hero, so the source row is
   * dropped there and the timestamp moves to the front of the meta row.
   */
  hideSource?: boolean
  /** Opens the feed detail page from the source chip. Omitted = not tappable. */
  onOpenFeed?: (feedId: string) => void
}

/**
 * One row in a mobile-web entry list. Shared by the home timeline and the feed
 * detail page so both stay in step when the card bodies change.
 */
export const EntryCard = memo(function EntryCard({
  entryId,
  view,
  onOpen,
  hideSource,
  onOpenFeed,
}: EntryCardProps) {
  const { t } = useTranslation()
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    description: e.description,
    publishedAt: e.publishedAt,
    feedId: e.feedId,
    media: e.media,
    attachments: e.attachments,
    property: e.extra?.property,
    url: e.url,
    read: e.read,
  }))

  const feed = useFeedById(entry?.feedId)

  const derived = useMemo(() => {
    if (!entry) return null
    const cardType = getCardType(view, {
      media: entry.media ?? undefined,
      attachments: entry.attachments ?? undefined,
    })
    const thumbnailUrl = entry.media?.find((m) => m.type === "photo")?.url
    const video = entry.media?.find((m) => m.type === "video")
    const videoThumbnail = video?.preview_image_url || video?.url || thumbnailUrl
    const images =
      entry.media
        ?.filter((m) => m.type === "photo")
        .map((m) => ({ url: m.url, blurhash: m.blurhash })) ?? []
    const durationRaw = entry.attachments?.find((a) => a.duration_in_seconds)?.duration_in_seconds
    const duration =
      typeof durationRaw === "string"
        ? Number.parseFloat(durationRaw)
        : typeof durationRaw === "number"
          ? durationRaw
          : undefined
    return { cardType, thumbnailUrl, videoThumbnail, images, duration }
  }, [entry, view])

  if (!entry || !derived) return null

  const handleOpen = () => onOpen(entryId)

  const property = resolvePropertyListing({
    property: entry.property,
    feedUrl: feed?.url,
    feedTitle: feed?.title,
    entryTitle: entry.title,
  })

  if (property) {
    const imageUrl =
      entry.media?.find((media) => media.type === "photo")?.url || property.image || undefined
    return (
      <PropertyCard
        property={property}
        fallbackTitle={entry.title ?? undefined}
        imageUrl={imageUrl}
        isRead={!!entry.read}
        publishedAt={entry.publishedAt}
        onOpen={handleOpen}
      />
    )
  }

  const { cardType, thumbnailUrl, videoThumbnail, images, duration } = derived
  const isRead = !!entry.read

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          handleOpen()
        }
      }}
      className={cn(
        "relative cursor-pointer border-b border-border/50 bg-background px-4 py-3 transition-colors active:bg-fill-secondary",
      )}
    >
      {!isRead && (
        <span aria-hidden className="absolute left-1 top-4 size-1.5 rounded-full bg-brand-accent" />
      )}
      {/* Source row */}
      <div className="mb-1.5 flex items-center gap-2">
        {hideSource ? (
          entry.publishedAt && (
            <span className="text-[13px] tabular-nums text-text-tertiary">
              <RelativeTime date={entry.publishedAt} />
            </span>
          )
        ) : (
          <>
            <FeedSourceChip
              feed={feed}
              isRead={isRead}
              fallback={t("mobile.home.unknown_source")}
              onOpenFeed={onOpenFeed}
            />
            {entry.publishedAt && (
              <span className="ml-auto shrink-0 text-[13px] text-text-tertiary">
                <RelativeTime date={entry.publishedAt} />
              </span>
            )}
          </>
        )}
      </div>

      {/* Title */}
      {entry.title && (
        <h3
          className={cn(
            "mb-1.5 line-clamp-2 text-[15px] font-bold leading-snug",
            isRead ? "text-text-secondary" : "text-text",
          )}
        >
          {entry.title}
        </h3>
      )}

      {/* Type-specific content */}
      {cardType === "article" && (
        <ArticleCardContent
          description={entry.description ?? undefined}
          thumbnailUrl={thumbnailUrl}
        />
      )}
      {cardType === "image" && images.length > 0 && <ImageCardContent images={images} />}
      {cardType === "video" && (
        <VideoCardContent thumbnailUrl={videoThumbnail} duration={duration} />
      )}
      {cardType === "podcast" && <PodcastCardContent duration={duration} entryId={entryId} />}
    </article>
  )
})

function FeedSourceChip({
  feed,
  isRead,
  fallback,
  onOpenFeed,
}: {
  feed: FeedModel | undefined
  isRead: boolean
  fallback: string
  onOpenFeed?: (feedId: string) => void
}) {
  const tappable = !!(onOpenFeed && feed?.id)

  const inner = (
    <>
      {feed && (
        <FeedIcon
          target={{
            title: feed.title,
            image: feed.image,
            siteUrl: feed.siteUrl,
            type: "feed",
          }}
          size={18}
          noMargin
        />
      )}
      <span
        className={cn(
          "min-w-0 truncate text-[13px] font-medium",
          isRead ? "text-text-tertiary" : "text-text-secondary",
        )}
      >
        {feed?.title ?? fallback}
      </span>
      {tappable && (
        <i aria-hidden className="i-mgc-right-cute-re shrink-0 text-xs text-text-quaternary" />
      )}
    </>
  )

  if (!tappable) {
    return <div className="flex min-w-0 items-center gap-2">{inner}</div>
  }

  return (
    <button
      type="button"
      // Stop the tap from also opening the entry underneath.
      onClick={(e) => {
        e.stopPropagation()
        onOpenFeed(feed!.id)
      }}
      className="-ml-1 flex min-w-0 items-center gap-2 rounded-full py-0.5 pl-1 pr-1.5 transition-colors active:bg-fill-secondary"
    >
      {inner}
    </button>
  )
}
