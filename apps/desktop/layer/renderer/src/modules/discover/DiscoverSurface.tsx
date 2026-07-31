import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useIsSubscribed } from "@follow/store/subscription/hooks"
import { cn, formatNumber } from "@follow/utils/utils"
import type { TrendingFeedItem } from "@follow-app/client-sdk"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router"

import { useUISettingKey } from "~/atoms/settings/ui"
import { useFollow } from "~/hooks/biz/useFollow"
import { navigateEntry } from "~/hooks/biz/useNavigateEntry"
import { followClient } from "~/lib/api-client"
import { FeedIcon } from "~/modules/feed/feed-icon"
import type { StarterPack } from "~/queries/packs"
import { usePacksQuery, usePackSubscribeMutation } from "~/queries/packs"
import type { Topic } from "~/queries/topics"
import { useTopicsQuery } from "~/queries/topics"

const FALLBACK_TILE_COLOR = "#8A8A8E"

const TOPIC_SKELETON_KEYS = Array.from({ length: 8 }, (_, index) => `topic-${index}`)
const TRENDING_SKELETON_KEYS = Array.from({ length: 6 }, (_, index) => `trending-${index}`)

/**
 * Oversized lightning glyph used as a watermark behind Discover banners.
 * Mirrors the `BoltMotif` in the design source.
 */
export function BoltMotif({ className, color }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <path d="M37 6 L18 38 h13 L25 58 L46 24 h-13 Z" fill={color ?? "currentColor"} />
    </svg>
  )
}

/** Desktop section heading: accent kicker above a display title. */
export function BoldSection({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-4">
      {kicker && (
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-accent-ink">
          {kicker}
        </div>
      )}
      <h2 className="m-0 text-[24px] font-semibold tracking-[-0.02em] text-text">{title}</h2>
    </div>
  )
}

/** Compact section heading for the narrow (mobile web) layout. */
export function MobileSectionHead({ title }: { title: string }) {
  return <h2 className="m-0 text-[19px] font-bold tracking-[-0.015em] text-text">{title}</h2>
}

/** Pill shortcut into one of the "add a feed" flows. */
export function QuickChip({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "border border-border bg-background text-text hover:bg-fill-secondary",
      )}
    >
      <i className={cn(icon, "size-4", active ? "" : "text-text-tertiary")} />
      {label}
    </button>
  )
}

/** Follow / Following pill shared by every Discover row. */
export function FollowPill({
  feedId,
  url,
  className,
}: {
  feedId?: string
  url?: string
  className?: string
}) {
  const { t } = useTranslation()
  const follow = useFollow()
  const isSubscribed = useIsSubscribed(feedId ?? "")

  return (
    <button
      type="button"
      onClick={() => follow({ isList: false, id: feedId, url })}
      className={cn(
        "h-7 shrink-0 rounded-full px-3.5 text-xs font-bold transition-colors",
        isSubscribed
          ? "border border-border bg-background text-text-secondary"
          : "bg-accent text-accent-fg hover:opacity-90",
        className,
      )}
    >
      {isSubscribed ? t("feed.actions.followed") : t("feed.actions.follow")}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Trending — ranked leaderboard
// ──────────────────────────────────────────────────────────────────────────
export function TrendingLeaderboard({
  limit = 8,
  columns = 1,
}: {
  limit?: number
  columns?: 1 | 2
}) {
  const lang = useUISettingKey("discoverLanguage")
  const { data, isLoading } = useQuery({
    queryKey: ["trending", "leaderboard", lang, limit],
    queryFn: () =>
      followClient.api.trending.getFeeds({
        language: lang === "all" ? undefined : lang,
        limit,
      }),
    meta: { persist: true },
  })

  if (isLoading) {
    return (
      <div className={cn("grid gap-2.5", columns === 2 && "grid-cols-2")}>
        {TRENDING_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn("grid gap-2.5", columns === 2 && "grid-cols-2")}>
      {data?.data?.map((item, index) => (
        <TrendingRow
          key={item.feed?.id || index}
          item={item}
          rank={index + 1}
          boxed={columns === 2}
        />
      ))}
    </div>
  )
}

function TrendingRow({
  item,
  rank,
  boxed,
}: {
  item: TrendingFeedItem
  rank: number
  boxed?: boolean
}) {
  const { t: tCommon } = useTranslation("common")
  const location = useLocation()
  const followers = item.analytics?.subscriptionCount

  return (
    <div
      className={cn(
        "flex items-center gap-3.5",
        boxed
          ? "rounded-xl border border-border-secondary bg-material-opaque px-3.5 py-3"
          : "border-b border-border-secondary py-2.5 last:border-b-0",
      )}
    >
      <div
        className={cn(
          "shrink-0 text-center font-bold tabular-nums",
          boxed ? "w-6 text-xl" : "w-5 text-base",
          rank <= 3 ? "text-accent-ink" : "text-text-quaternary",
        )}
      >
        {rank}
      </div>

      <button
        type="button"
        disabled={!item.feed?.id}
        onClick={() => {
          if (!item.feed?.id) return
          navigateEntry({
            feedId: item.feed.id,
            view: item.analytics?.view ?? 0,
            backPath: `${location.pathname}${location.search}`,
          })
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <FeedIcon
          target={item.feed ? { ...item.feed, type: "feed" } : null}
          size={boxed ? 40 : 36}
          className="shrink-0"
          noMargin
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text">{item.feed?.title}</div>
          {!!followers && (
            <div className="mt-0.5 text-xs text-text-tertiary">
              {formatNumber(followers)} {tCommon("feed.follower", { count: followers })}
            </div>
          )}
        </div>
      </button>

      <FollowPill feedId={item.feed?.id} url={item.feed?.url} />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Topics — full-colour tiles
// ──────────────────────────────────────────────────────────────────────────
export function TopicTiles({ columns = 4, tall }: { columns?: 2 | 3 | 4; tall?: boolean }) {
  const { data, isLoading } = useTopicsQuery()

  if (!isLoading && (!data || data.length === 0)) {
    return null
  }

  const gridClassName = cn(
    "grid gap-2.5",
    columns === 2 && "grid-cols-2",
    columns === 3 && "grid-cols-3",
    columns === 4 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 lg:gap-3.5",
  )

  return (
    <div className={gridClassName}>
      {isLoading
        ? TOPIC_SKELETON_KEYS.slice(0, columns * 2).map((key) => (
            <Skeleton
              key={key}
              className={cn("w-full rounded-2xl", tall ? "h-[116px]" : "h-[86px]")}
            />
          ))
        : data!.map((topic) => <TopicTile key={topic.id} topic={topic} tall={tall} />)}
    </div>
  )
}

export function TopicTile({ topic, tall }: { topic: Topic; tall?: boolean }) {
  const color = topic.color ?? FALLBACK_TILE_COLOR

  return (
    <Link
      to={`/discover/topic/${topic.slug}`}
      className={cn(
        "relative flex flex-col justify-end overflow-hidden p-3.5 text-white",
        "shadow-[var(--shadow-card)] transition-transform hover:scale-[1.02] active:scale-[0.98]",
        tall ? "h-[116px] rounded-2xl" : "h-[86px] rounded-[14px]",
      )}
      style={{ backgroundColor: color }}
    >
      {/* Soft highlight disc, bleeding off the top-right corner */}
      <div
        className={cn(
          "absolute rounded-full bg-white/[0.18]",
          tall ? "right-[-18px] top-[-18px] size-[88px]" : "-right-3.5 -top-3.5 size-16",
        )}
      />
      <div className="relative">
        <div className={cn("font-bold leading-tight", tall ? "text-lg" : "text-[15px]")}>
          {topic.label}
        </div>
        {topic.description && (
          <div className="mt-0.5 line-clamp-1 text-[11px] font-semibold leading-tight text-white/85">
            {topic.description}
          </div>
        )}
      </div>
    </Link>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Starter packs — curated bundles
// ──────────────────────────────────────────────────────────────────────────
export function StarterPackGrid({ columns }: { columns?: 3 }) {
  const { data } = usePacksQuery()

  if (!data || data.length === 0) return null

  if (!columns) {
    // Narrow layout: horizontal carousel, bleeding into the screen gutters.
    return (
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1.5">
        {data.map((pack) => (
          <StarterPackCard key={pack.id} pack={pack} className="w-[220px] shrink-0" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
      {data.map((pack) => (
        <StarterPackCard key={pack.id} pack={pack} />
      ))}
    </div>
  )
}

export function StarterPackCard({ pack, className }: { pack: StarterPack; className?: string }) {
  const { t } = useTranslation()
  const subscribe = usePackSubscribeMutation()
  const followed = subscribe.isSuccess

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-background shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div
        className="flex h-[92px] items-end p-3"
        style={{ backgroundColor: pack.color ?? FALLBACK_TILE_COLOR }}
      >
        <div className="flex">
          {pack.previews.map((preview, index) => (
            <div
              key={preview.feedId}
              className="flex size-[34px] items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white text-sm font-bold"
              style={{
                color: pack.color ?? FALLBACK_TILE_COLOR,
                marginLeft: index ? -10 : 0,
              }}
            >
              {preview.image ? (
                <img src={preview.image} alt="" className="size-full object-cover" />
              ) : (
                (preview.title || "?").slice(0, 1).toUpperCase()
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="text-base font-bold text-text">{pack.name}</div>
        <div className="mt-1 line-clamp-2 min-h-[38px] text-[13px] leading-snug text-text-tertiary">
          {pack.description}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-text-secondary">
            {t("mobile.discover.pack_feed_count", { count: pack.feedCount })}
          </span>
          <button
            type="button"
            disabled={subscribe.isPending || followed}
            onClick={() => subscribe.mutate(pack.slug)}
            className={cn(
              "h-[30px] rounded-full px-3.5 text-xs font-bold transition-colors",
              followed
                ? "bg-accent text-accent-fg"
                : "bg-fill text-text hover:bg-fill-secondary disabled:opacity-60",
            )}
          >
            {followed ? t("feed.actions.followed") : t("mobile.discover.follow_all")}
          </button>
        </div>
      </div>
    </div>
  )
}
