import { EmptyStage } from "@follow/components/ui/empty/index.js"
import type { FeedViewType } from "@follow/constants"
import { getViewList } from "@follow/constants"
import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { useViewWithSubscription } from "@follow/store/subscription/hooks"
import { useUnreadByView } from "@follow/store/unread/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { useAtom, useSetAtom } from "jotai"
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { RelativeTime } from "~/components/ui/datetime"
import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { useEntriesActions, useEntriesState } from "~/modules/entry-column/context/EntriesContext"
import { FeedIcon } from "~/modules/feed/feed-icon"

import { mobileActiveViewAtom, mobileReaderEntryIdAtom } from "../atoms"
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
  const { t } = useTranslation()
  const { present } = useModalStack()

  const openLogin = () => {
    present({
      id: "login",
      title: t("words.login"),
      CustomModalComponent: PlainModal,
      content: () => <LoginModalContent runtime="browser" />,
      clickOutsideToDismiss: true,
    })
  }

  return (
    <div className="flex flex-col items-center px-6 py-12">
      <EmptyStage
        eyebrow={t("mobile.home.welcome.title")}
        glyph={<i className="i-mgc-rss-cute-fi" />}
        title={t("mobile.home.welcome.title")}
        body={t("mobile.home.welcome.body")}
        size="md"
      />
      <button
        type="button"
        className="mt-6 rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80"
        onClick={openLogin}
      >
        {t("words.login")}
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
        "sticky top-0 z-10 border-b border-border/60 bg-background/85 backdrop-blur-lg transition-transform duration-200",
        hidden && "-translate-y-full",
      )}
    >
      <div className="flex w-full items-stretch gap-1.5 px-3.5 py-2">
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
      className={cn(
        "relative flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors duration-150",
        isActive
          ? "bg-brand-accent text-black"
          : "bg-fill-tertiary text-text-secondary hover:text-text",
      )}
    >
      <span className="shrink-0 text-base leading-none">{viewDef.icon}</span>
      <span className="truncate capitalize">{label}</span>
      {!isActive && unread > 0 && (
        <span className="absolute right-1.5 top-1 size-1.5 rounded-full bg-brand-accent" />
      )}
    </button>
  )
})

function AuthenticatedHomeFeed() {
  const { t } = useTranslation()
  const state = useEntriesState()
  const actions = useEntriesActions()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [filterBarHidden, setFilterBarHidden] = useState(false)

  const { entriesIds, isLoading, isFetchingNextPage, hasNextPage } = state

  useEffect(() => {
    const el = scrollRef.current?.parentElement
    if (!el) return

    let lastScrollTop = 0
    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = el
        const delta = scrollTop - lastScrollTop
        if (Math.abs(delta) > 5) {
          setFilterBarHidden(delta > 0 && scrollTop > 44)
        }
        lastScrollTop = scrollTop
        if (scrollHeight - scrollTop - clientHeight < 500 && hasNextPage && !isFetchingNextPage) {
          actions.fetchNextPage()
        }
        ticking = false
      })
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
        <div className="px-6 py-12">
          <EmptyStage
            eyebrow={t("mobile.home.empty.title")}
            glyph={<i className="i-mgc-inbox-cute-re" />}
            title={t("mobile.home.empty.title")}
            body={t("mobile.home.empty.body")}
            size="md"
          />
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
            <div className="py-6 text-center text-sm text-text-tertiary">
              {t("mobile.home.end")}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const EntryCard = memo(function EntryCard({ entryId }: { entryId: string }) {
  const { t } = useTranslation()
  const [activeView] = useAtom(mobileActiveViewAtom)
  const setReaderEntryId = useSetAtom(mobileReaderEntryIdAtom)
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    description: e.description,
    publishedAt: e.publishedAt,
    feedId: e.feedId,
    media: e.media,
    attachments: e.attachments,
    url: e.url,
    read: e.read,
  }))

  const feed = useFeedById(entry?.feedId)

  const derived = useMemo(() => {
    if (!entry) return null
    const cardType = getCardType(activeView, {
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
  }, [entry, activeView])

  if (!entry || !derived) return null

  const handleOpen = () => {
    setReaderEntryId(entryId)
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
          {feed?.title ?? t("mobile.home.unknown_source")}
        </span>
        {entry.publishedAt && (
          <span className="ml-auto shrink-0 text-[13px] text-text-tertiary">
            <RelativeTime date={entry.publishedAt} />
          </span>
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
