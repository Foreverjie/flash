import type { FeedViewType } from "@follow/constants"
import { getViewList } from "@follow/constants"
import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { useViewWithSubscription } from "@follow/store/subscription/hooks"
import { useUnreadByView } from "@follow/store/unread/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { useAtom } from "jotai"
import { memo, useEffect, useRef, useState } from "react"

import { RelativeTime } from "~/components/ui/datetime"
import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { useEntriesActions, useEntriesState } from "~/modules/entry-column/context/EntriesContext"
import { FeedIcon } from "~/modules/feed/feed-icon"

import { mobileActiveViewAtom } from "../atoms"
import { ArticleCardContent } from "../cards/ArticleCard"
import { getCardType } from "../cards/getCardType"
import { ImageCardContent } from "../cards/ImageCard"
import { PodcastCardContent } from "../cards/PodcastCard"
import { VideoCardContent } from "../cards/VideoCard"

const ALL_VIEW_DEFS = getViewList({ includeAll: true })

export function HomeFeedScreen() {
  const user = useWhoami()

  if (!user) {
    return <PublicHomeFeed />
  }

  return <AuthenticatedHomeFeed />
}

function PublicHomeFeed() {
  const { present } = useModalStack()

  const openLogin = () => {
    present({
      id: "login",
      title: "Login",
      CustomModalComponent: PlainModal,
      content: () => <LoginModalContent runtime="browser" />,
      clickOutsideToDismiss: true,
    })
  }

  return (
    <div className="flex flex-col items-center justify-center px-6 py-20">
      <i className="i-mgc-rss-cute-fi mb-4 text-5xl text-brand-accent" />
      <h2 className="mb-1.5 text-lg font-semibold text-text">Welcome to Flash</h2>
      <p className="mb-6 text-center text-sm text-text-tertiary">
        Sign in to follow your favorite feeds, podcasts, and videos.
      </p>
      <button
        type="button"
        className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80"
        onClick={openLogin}
      >
        Sign In
      </button>
    </div>
  )
}

function ViewFilterBar({ hidden }: { hidden: boolean }) {
  const viewsWithSub = useViewWithSubscription()
  const [activeView, setActiveView] = useAtom(mobileActiveViewAtom)

  if (viewsWithSub.length <= 1) return null

  return (
    <div
      className={cn(
        "sticky top-0 z-10 bg-background/80 backdrop-blur-lg transition-transform duration-200",
        hidden && "-translate-y-full",
      )}
    >
      <div className="flex w-full items-center gap-1 px-3 py-2">
        {viewsWithSub.map((viewType) => {
          const viewDef = ALL_VIEW_DEFS.find((v) => v.view === viewType)
          if (!viewDef) return null
          return (
            <ViewChip
              key={viewType}
              view={viewType}
              viewDef={viewDef}
              isActive={activeView === viewType}
              onClick={() => setActiveView(viewType)}
            />
          )
        })}
      </div>
    </div>
  )
}

const ViewChip = memo(function ViewChip({
  view,
  viewDef,
  isActive,
  onClick,
}: {
  view: FeedViewType
  viewDef: { name: string; icon: React.JSX.Element; className: string }
  isActive: boolean
  onClick: () => void
}) {
  const unread = useUnreadByView(view)
  const label = viewDef.name.split(".").pop()?.replaceAll("_", " ") ?? ""

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ flex: isActive ? "1 1 0%" : "0 0 2.5rem" }}
      className={cn(
        "relative flex items-center justify-center gap-1.5 rounded-full py-2 font-medium transition-[flex,background-color,color] duration-300 ease-out",
        isActive ? "bg-fill-secondary text-text" : "text-text-tertiary",
      )}
    >
      <span
        className={cn(
          "shrink-0 text-lg transition-colors duration-300",
          isActive && viewDef.className,
        )}
      >
        {viewDef.icon}
      </span>
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap text-sm capitalize transition-[max-width,opacity] duration-300 ease-out",
          isActive ? "max-w-24 opacity-100" : "max-w-0 opacity-0",
        )}
      >
        {label}
      </span>
      {!isActive && unread > 0 && (
        <span className="absolute right-1 top-0.5 size-1.5 rounded-full bg-brand-accent" />
      )}
    </button>
  )
})

function useScrollDirection(ref: React.RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false)
  const lastScrollTop = useRef(0)

  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return

    const handleScroll = () => {
      const { scrollTop } = el
      const delta = scrollTop - lastScrollTop.current
      if (Math.abs(delta) > 5) {
        setHidden(delta > 0 && scrollTop > 44)
      }
      lastScrollTop.current = scrollTop
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [ref])

  return hidden
}

function AuthenticatedHomeFeed() {
  const state = useEntriesState()
  const actions = useEntriesActions()
  const scrollRef = useRef<HTMLDivElement>(null)
  const filterBarHidden = useScrollDirection(scrollRef)

  const { entriesIds, isLoading, isFetchingNextPage, hasNextPage } = state

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current?.parentElement
    if (!el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight - scrollTop - clientHeight < 500 && hasNextPage && !isFetchingNextPage) {
        actions.fetchNextPage()
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [hasNextPage, isFetchingNextPage, actions])

  return (
    <div ref={scrollRef} className="flex flex-col">
      <ViewFilterBar hidden={filterBarHidden} />
      {isLoading && entriesIds.length === 0 ? (
        Array.from({ length: 6 }).map((_, i) => <EntryCardSkeleton key={i} />)
      ) : !isLoading && entriesIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
          <i className="i-mgc-inbox-cute-re mb-3 text-4xl" />
          <p>No entries yet</p>
          <p className="mt-1 text-sm">Subscribe to some feeds to get started</p>
        </div>
      ) : (
        <>
          {entriesIds.map((id) => (
            <EntryCard key={id} entryId={id} />
          ))}
          {isFetchingNextPage && (
            <div className="flex items-center justify-center py-4">
              <i className="i-mgc-loading-3-cute-re animate-spin text-xl text-text-tertiary" />
            </div>
          )}
          {!hasNextPage && entriesIds.length > 0 && (
            <div className="py-6 text-center text-sm text-text-tertiary">No more entries</div>
          )}
        </>
      )}
    </div>
  )
}

function EntryCard({ entryId }: { entryId: string }) {
  const [activeView] = useAtom(mobileActiveViewAtom)
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    description: e.description,
    publishedAt: e.publishedAt,
    feedId: e.feedId,
    media: e.media,
    attachments: e.attachments,
  }))

  const feed = useFeedById(entry?.feedId)

  if (!entry) return null

  const cardType = getCardType(activeView, {
    media: entry.media ?? undefined,
    attachments: entry.attachments ?? undefined,
  })

  const thumbnailUrl = entry.media?.find((m) => m.type === "photo")?.url
  const videoThumbnail =
    entry.media?.find((m) => m.type === "video")?.preview_image_url ||
    entry.media?.find((m) => m.type === "video")?.url ||
    entry.media?.find((m) => m.type === "photo")?.url
  const images =
    entry.media
      ?.filter((m) => m.type === "photo")
      .map((m) => ({ url: m.url, blurhash: m.blurhash })) ?? []
  const durationAttachment = entry.attachments?.find((attachment) => attachment.duration_in_seconds)
  const duration = durationAttachment?.duration_in_seconds
    ? typeof durationAttachment.duration_in_seconds === "string"
      ? Number.parseFloat(durationAttachment.duration_in_seconds)
      : durationAttachment.duration_in_seconds
    : undefined

  return (
    <article className="cursor-pointer border-b border-border/50 bg-background px-4 py-3">
      {/* Source row */}
      <div className="mb-1.5 flex items-center gap-2">
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
        <span className="min-w-0 truncate text-[13px] font-medium text-text-secondary">
          {feed?.title ?? "Unknown"}
        </span>
        {entry.publishedAt && (
          <span className="ml-auto shrink-0 text-[13px] text-text-tertiary">
            <RelativeTime date={entry.publishedAt} />
          </span>
        )}
      </div>

      {/* Title */}
      {entry.title && (
        <h3 className="mb-1.5 line-clamp-2 text-[15px] font-bold leading-snug text-text">
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
}

function EntryCardSkeleton() {
  return (
    <div className="border-b border-border/50 bg-background px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="size-[18px] animate-pulse rounded-sm bg-fill-tertiary" />
        <div className="h-3 w-24 animate-pulse rounded bg-fill-tertiary" />
        <div className="ml-auto h-3 w-12 animate-pulse rounded bg-fill-tertiary" />
      </div>
      <div className="mb-2 h-4 w-4/5 animate-pulse rounded bg-fill-tertiary" />
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="mb-1 h-3 w-full animate-pulse rounded bg-fill-tertiary" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-fill-tertiary" />
        </div>
        <div className="size-20 animate-pulse rounded-xl bg-fill-tertiary" />
      </div>
    </div>
  )
}
