import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { FeedViewType } from "@follow/constants"
import { useEntriesQuery } from "@follow/store/entry/hooks"
import { useFeedById, usePrefetchFeed, usePrefetchFeedAnalytics } from "@follow/store/feed/hooks"
import { feedSyncServices } from "@follow/store/feed/store"
import type { FeedModel } from "@follow/store/feed/types"
import { useSubscriptionByFeedId } from "@follow/store/subscription/hooks"
import { formatNumber } from "@follow/utils"
import { cn } from "@follow/utils/utils"
import { useSetAtom } from "jotai"
import { AnimatePresence } from "motion/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { RelativeTime } from "~/components/ui/datetime"
import { useDeleteSubscription } from "~/hooks/biz/useSubscriptionActions"
import { FeedIcon } from "~/modules/feed/feed-icon"

import { mobileReaderEntryIdAtom } from "../atoms"
import { EntryCard } from "../cards/EntryCard"
import { MobileFollowSheet } from "../MobileFollowSheet"
import { MobileSheet } from "../MobileSheet"
import type { PullState } from "../usePullToRefresh"
import { usePullToRefresh } from "../usePullToRefresh"

/**
 * Mobile-web feed detail: identity hero with the follow action, a feed-info
 * sheet, and the feed's own entry list with pull-to-refresh.
 */
export function MobileFeedDetailScreen() {
  const { feedId } = useParams<{ feedId: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const setReaderEntryId = useSetAtom(mobileReaderEntryIdAtom)

  const feed = useFeedById(feedId)
  usePrefetchFeed(feedId, { enabled: !!feedId })
  usePrefetchFeedAnalytics(feedId!, { enabled: !!feedId })

  const subscription = useSubscriptionByFeedId(feedId)
  const view = subscription?.view ?? FeedViewType.Articles

  const [infoOpen, setInfoOpen] = useState(false)
  const [followOpen, setFollowOpen] = useState(false)

  const entriesQuery = useEntriesQuery(useMemo(() => ({ feedId, view }), [feedId, view]))
  const { entriesIds, isLoading, isFetchingNextPage, hasNextPage } = entriesQuery

  const sheetRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    scrollRef.current = sheetRef.current?.parentElement ?? null
  }, [])

  const refresh = useCallback(async () => {
    // `POST /entries` only re-reads the database. Ask the server to pull the
    // source first — refreshFeed self-gates and resolves false when this feed
    // is the scheduler's job — then re-read either way.
    let failed = false
    try {
      await feedSyncServices.refreshFeed(feedId!)
    } catch {
      failed = true
    }

    try {
      const result = await entriesQuery.refetch()
      failed ||= result.isError
    } catch {
      failed = true
    }

    if (failed) {
      toast.error(t("mobile.feed.refresh_failed"))
    }
  }, [entriesQuery, feedId, t])

  const { offset, state: pullState } = usePullToRefresh({ scrollRef, onRefresh: refresh })

  // Infinite scroll off the shell's scroll container.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let ticking = false
    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = el
        if (scrollHeight - scrollTop - clientHeight < 500 && hasNextPage && !isFetchingNextPage) {
          entriesQuery.fetchNextPage()
        }
        ticking = false
      })
    }
    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [hasNextPage, isFetchingNextPage, entriesQuery])

  if (!feedId) return null

  return (
    <div className="relative">
      <FeedDetailHeader
        title={feed?.title ?? undefined}
        image={feed?.image ?? undefined}
        siteUrl={feed?.siteUrl ?? undefined}
        shareUrl={feed?.siteUrl ?? feed?.url ?? undefined}
        onBack={() => navigate(-1)}
      />

      <PullIndicator state={pullState} />

      <div
        ref={sheetRef}
        className="relative bg-background will-change-transform"
        style={{
          transform: `translateY(${offset}px)`,
          transition: pullState === "pulling" || pullState === "armed" ? "none" : "transform .3s",
        }}
      >
        <FeedHero
          feed={feed}
          feedId={feedId}
          onOpenInfo={() => setInfoOpen(true)}
          onFollow={() => setFollowOpen(true)}
        />

        <div className="flex items-center gap-2 px-4 pb-1.5 pt-3.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">
            {t("mobile.feed.latest")}
          </span>
          <span aria-hidden className="h-px flex-1 bg-border/60" />
          {feed?.latestEntryPublishedAt && (
            <span className="text-xs text-text-tertiary">
              <RelativeTime date={feed.latestEntryPublishedAt} />
            </span>
          )}
        </div>

        {isLoading && entriesIds.length === 0 ? (
          Array.from({ length: 5 }).map((_, i) => <EntryRowSkeleton key={i} />)
        ) : entriesIds.length === 0 ? (
          <div className="px-6 py-12">
            <EmptyStage
              eyebrow={t("mobile.feed.empty.title")}
              glyph={<i className="i-mgc-inbox-cute-re" />}
              title={t("mobile.feed.empty.title")}
              body={t("mobile.feed.empty.body")}
              size="md"
            />
          </div>
        ) : (
          <>
            {entriesIds.map((id) => (
              <EntryCard key={id} entryId={id} view={view} hideSource onOpen={setReaderEntryId} />
            ))}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <i className="i-mgc-loading-3-cute-re animate-spin text-xl text-text-tertiary" />
              </div>
            )}
            {!hasNextPage && (
              <div className="px-4 py-6 text-center text-sm text-text-tertiary">
                {t("mobile.feed.caught_up")}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sheets live outside the pull-to-refresh container: its `transform`
          would otherwise become the containing block for their `fixed` layout. */}
      <AnimatePresence>
        {infoOpen && <FeedInfoSheet feedId={feedId} onClose={() => setInfoOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {followOpen && (
          <MobileFollowSheet feed={feed} feedId={feedId} onClose={() => setFollowOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}

function FeedDetailHeader({
  title,
  image,
  siteUrl,
  shareUrl,
  onBack,
}: {
  title?: string
  image?: string
  siteUrl?: string
  /** Site page when the feed exposes one, otherwise the raw feed URL. */
  shareUrl?: string
  onBack: () => void
}) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")

  const share = async () => {
    if (!shareUrl) return
    if (navigator.share) {
      try {
        await navigator.share({ title: title ?? undefined, url: shareUrl })
        return
      } catch {
        // User dismissed the share sheet, or it is unavailable — fall through.
      }
    }
    await navigator.clipboard.writeText(shareUrl)
    toast.success(tCommon("app.copied_to_clipboard"))
  }

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-border/60 bg-material-thick px-2 pt-safe-area-top backdrop-blur-background">
      <button
        type="button"
        aria-label={tCommon("words.back")}
        onClick={onBack}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors active:bg-fill-secondary"
      >
        <i className="i-mgc-arrow-left-cute-re text-xl" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FeedIcon target={{ title, image, siteUrl, type: "feed" }} size={18} noMargin />
        <span className="truncate text-sm font-semibold text-text">{title ?? ""}</span>
      </div>
      <button
        type="button"
        aria-label={t("mobile.feed.share")}
        onClick={share}
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors active:bg-fill-secondary"
      >
        <i className="i-mgc-share-forward-cute-re text-lg" />
      </button>
    </header>
  )
}

function PullIndicator({ state }: { state: PullState }) {
  const { t } = useTranslation()
  if (state === "none") return null
  const refreshing = state === "refreshing"

  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 flex h-16 flex-col items-center justify-center gap-1.5 text-text-tertiary">
      <i
        className={cn(
          "text-lg",
          refreshing
            ? "i-mgc-refresh-2-cute-re animate-spin text-accent-ink"
            : // The arrow flips upright once the gesture is past the threshold.
              cn("i-mgc-up-cute-re transition-transform", state === "armed" ? "" : "rotate-180"),
        )}
      />
      <span className="text-[11px] font-semibold">
        {refreshing
          ? t("mobile.feed.refreshing")
          : state === "armed"
            ? t("mobile.feed.release_to_refresh")
            : t("mobile.feed.pull_to_refresh")}
      </span>
    </div>
  )
}

function FeedHero({
  feed,
  feedId,
  onOpenInfo,
  onFollow,
}: {
  feed: FeedModel | undefined
  feedId: string
  onOpenInfo: () => void
  onFollow: () => void
}) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const subscription = useSubscriptionByFeedId(feedId)
  const isSubscribed = !!subscription
  const { mutate: deleteSubscription, isPending: isUnsubscribing } = useDeleteSubscription()

  const host = useMemo(() => {
    const raw = feed?.siteUrl || feed?.url
    if (!raw) return
    try {
      return new URL(raw).host
    } catch {
      return raw
    }
  }, [feed?.siteUrl, feed?.url])

  return (
    <section className="border-b border-border/60 p-4">
      <div className="flex items-start gap-3">
        <FeedIcon
          target={{
            title: feed?.title,
            image: feed?.image,
            siteUrl: feed?.siteUrl,
            type: "feed",
          }}
          size={52}
          noMargin
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <h1 className="truncate text-xl font-bold tracking-tight text-text">
            {feed?.title ?? t("mobile.home.unknown_source")}
          </h1>
          {host && <p className="mt-0.5 truncate font-mono text-xs text-text-tertiary">{host}</p>}
        </div>
      </div>

      {feed?.description && (
        <p className="mt-3 text-pretty text-[13.5px] leading-relaxed text-text-secondary">
          {feed.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-text-tertiary">
        {!!feed?.subscriptionCount && (
          <span>
            <b className="font-semibold text-text">{formatNumber(feed.subscriptionCount)}</b>{" "}
            {tCommon("feed.follower", { count: feed.subscriptionCount })}
          </span>
        )}
        {!!feed?.updatesPerWeek && (
          <span>{tCommon("feed.entry_week", { count: feed.updatesPerWeek })}</span>
        )}
      </div>

      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          disabled={isUnsubscribing}
          onClick={() => {
            if (isSubscribed) {
              deleteSubscription({ subscription })
            } else {
              onFollow()
            }
          }}
          className={cn(
            "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold transition-opacity active:opacity-80 disabled:opacity-50",
            isSubscribed
              ? "border border-border text-text"
              : "bg-brand-accent text-[var(--fo-accent-fg)]",
          )}
        >
          <i className={isSubscribed ? "i-mgc-check-cute-re" : "i-mgc-add-cute-re"} />
          <span>{isSubscribed ? t("mobile.feed.subscribed") : tCommon("words.follow")}</span>
        </button>
        <button
          type="button"
          onClick={onOpenInfo}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-fill-quinary px-4 text-sm font-semibold text-text transition-opacity active:opacity-80"
        >
          <i className="i-mgc-information-cute-re" />
          <span>{t("mobile.feed.info")}</span>
        </button>
      </div>
    </section>
  )
}

function FeedInfoSheet({ feedId, onClose }: { feedId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const feed = useFeedById(feedId)
  const subscription = useSubscriptionByFeedId(feedId)

  const rows = useMemo(() => {
    const list: Array<{ key: string; label: string; value: React.ReactNode; mono?: boolean }> = []
    if (feed?.url) {
      list.push({ key: "url", label: t("mobile.feed.info_url"), value: feed.url, mono: true })
    }
    if (feed?.siteUrl) {
      list.push({ key: "site", label: t("mobile.feed.info_site"), value: feed.siteUrl, mono: true })
    }
    if (typeof feed?.subscriptionCount === "number") {
      list.push({
        key: "followers",
        label: t("mobile.feed.info_followers"),
        value: formatNumber(feed.subscriptionCount),
      })
    }
    if (feed?.updatesPerWeek) {
      list.push({
        key: "cadence",
        label: t("mobile.feed.info_cadence"),
        value: tCommon("feed.entry_week", { count: feed.updatesPerWeek }),
      })
    }
    if (feed?.latestEntryPublishedAt) {
      list.push({
        key: "updated",
        label: t("mobile.feed.info_updated"),
        value: <RelativeTime date={feed.latestEntryPublishedAt} />,
      })
    }
    if (subscription?.category) {
      list.push({
        key: "category",
        label: t("mobile.feed.info_category"),
        value: subscription.category,
      })
    }
    return list
  }, [feed, subscription, t, tCommon])

  return (
    <MobileSheet label={t("mobile.feed.info")} onClose={onClose}>
      <div className="flex items-center gap-2.5">
        <FeedIcon
          target={{
            title: feed?.title,
            image: feed?.image,
            siteUrl: feed?.siteUrl,
            type: "feed",
          }}
          size={34}
          noMargin
        />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-text">{feed?.title}</div>
          {!!feed?.subscriptionCount && (
            <div className="text-xs text-text-tertiary">
              {formatNumber(feed.subscriptionCount)}{" "}
              {tCommon("feed.follower", { count: feed.subscriptionCount })}
            </div>
          )}
        </div>
      </div>

      <dl className="mt-3.5 pb-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex justify-between gap-4 border-t border-border/60 py-2.5 text-[13px]"
          >
            <dt className="shrink-0 text-text-tertiary">{row.label}</dt>
            <dd
              className={cn(
                "min-w-0 truncate text-right text-text",
                row.mono && "font-mono text-xs",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </MobileSheet>
  )
}

function EntryRowSkeleton() {
  return (
    <div className="border-b border-border/50 bg-background px-4 py-3">
      <div className="mb-2 h-3 w-16 animate-pulse rounded bg-fill-tertiary" />
      <div className="mb-2 h-4 w-4/5 animate-pulse rounded bg-fill-tertiary" />
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="mb-1 h-3 w-full animate-pulse rounded bg-fill-tertiary" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-fill-tertiary" />
        </div>
        <div className="size-16 animate-pulse rounded-lg bg-fill-tertiary" />
      </div>
    </div>
  )
}
