import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Button } from "@follow/components/ui/button/index.js"
import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { LoadingCircle } from "@follow/components/ui/loading/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useIsSubscribed } from "@follow/store/subscription/hooks"
import { cn, formatNumber } from "@follow/utils/utils"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate, useParams } from "react-router"

import { useFollow } from "~/hooks/biz/useFollow"
import { navigateEntry } from "~/hooks/biz/useNavigateEntry"
import { useSubViewTitle } from "~/modules/app-layout/subview/hooks"
import { BoltMotif } from "~/modules/discover/DiscoverSurface"
import { FeedIcon } from "~/modules/feed/feed-icon"
import type { FeedItem } from "~/queries/feeds"
import {
  useOnboardingSubscribeMutation,
  useTopicFeedsQuery,
  useTopicsQuery,
} from "~/queries/topics"

const FALLBACK_TOPIC_COLOR = "#8A8A8E"

export const Component = () => {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const navigate = useNavigate()
  const isMobile = useMobile()
  const slug = useParams().slug as string
  const topics = useTopicsQuery()
  const topic = topics.data?.find((item) => item.slug === slug)
  const title = topic?.label ?? slug
  const color = topic?.color ?? FALLBACK_TOPIC_COLOR

  useSubViewTitle(<span>{title}</span>, title)

  const { data: feeds, isError, isLoading, refetch } = useTopicFeedsQuery(slug)
  const followAll = useOnboardingSubscribeMutation()

  return (
    <div className="w-full">
      {/* Colour banner — pulled up under the floating subview header on desktop */}
      <div
        className={cn(
          "relative w-full overflow-hidden pb-9 text-white",
          isMobile ? "pt-4" : "-mt-24 pt-28",
        )}
        style={{ backgroundColor: color }}
      >
        <BoltMotif className="pointer-events-none absolute -right-10 -top-24 size-[360px] text-white/[0.16]" />

        <div className="relative mx-auto w-full max-w-[1040px] px-6 lg:px-12">
          <button
            type="button"
            onClick={() => navigate("/discover")}
            className="inline-flex h-8 items-center gap-1 rounded-full bg-white/20 pl-2 pr-3.5 text-[13px] font-bold text-white transition-colors hover:bg-white/30"
          >
            <i className="i-mingcute-left-line size-4" />
            {t("words.discover")}
          </button>

          {topics.isLoading ? (
            <Skeleton className="mt-6 h-12 w-56 rounded-lg bg-white/25" />
          ) : (
            <>
              <div className="mt-6 text-xs font-bold uppercase tracking-[0.22em] opacity-85">
                {t("discover.topic_eyebrow")}
              </div>
              <h1 className="m-0 mt-2 text-[44px] font-semibold leading-none tracking-[-0.03em] lg:text-[54px]">
                {title}
              </h1>
              {topic?.description && (
                <p className="m-0 mt-3.5 max-w-[560px] text-base leading-normal opacity-90">
                  {topic.description}
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  disabled={followAll.isPending || followAll.isSuccess || !feeds?.length}
                  onClick={() => followAll.mutate({ feedIds: [], topicSlugs: [slug] })}
                  className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-white px-5 text-[15px] font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ color }}
                >
                  <i
                    className={cn(
                      "size-4",
                      followAll.isSuccess ? "i-mgc-check-cute-re" : "i-mgc-add-cute-re",
                    )}
                  />
                  <span>
                    {followAll.isSuccess
                      ? t("feed.actions.followed")
                      : t("mobile.discover.follow_all")}
                  </span>
                </button>
                {!!feeds?.length && (
                  <span className="text-sm font-semibold opacity-90">
                    {t("mobile.discover.pack_feed_count", { count: feeds.length })}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1040px] px-6 pb-10 lg:px-12">
        {isLoading ? (
          <div className="center py-16">
            <LoadingCircle size="large" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <EmptyStage
              glyph={<i className="i-mgc-warning-cute-re text-red" />}
              title={t("mobile.discover.topic_error")}
              body={t("mobile.discover.topic_error_body")}
              action={
                <Button variant="primary" onClick={() => refetch()}>
                  {tCommon("retry")}
                </Button>
              }
              size="md"
            />
          </div>
        ) : feeds && feeds.length > 0 ? (
          <div className="mt-8 grid gap-2.5 md:grid-cols-2">
            {feeds.map((feed, index) => (
              <TopicFeedRow key={feed.id} feed={feed} rank={index + 1} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-16">
            <EmptyStage
              glyph={<i className="i-mgc-search-cute-re" />}
              title={t("mobile.discover.topic_empty")}
              body={t("mobile.discover.topic_empty_body")}
              size="md"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function TopicFeedRow({ feed, rank }: { feed: FeedItem; rank: number }) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const location = useLocation()
  const follow = useFollow()
  const isSubscribed = useIsSubscribed(feed.id)
  const followers = feed.subscriptionCount ?? 0

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border-secondary bg-material-opaque px-3.5 py-2.5">
      <div
        className={cn(
          "w-6 shrink-0 text-center text-lg font-bold tabular-nums",
          rank <= 3 ? "text-accent-ink" : "text-text-quaternary",
        )}
      >
        {rank}
      </div>

      <button
        type="button"
        onClick={() => {
          navigateEntry({
            feedId: feed.id,
            view: 0,
            backPath: `${location.pathname}${location.search}`,
          })
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <FeedIcon target={{ ...feed, type: "feed" }} size={40} className="shrink-0" noMargin />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text">{feed.title}</div>
          {feed.description ? (
            <div className="mt-0.5 truncate text-xs text-text-tertiary">{feed.description}</div>
          ) : (
            !!followers && (
              <div className="mt-0.5 text-xs text-text-tertiary">
                {formatNumber(followers)} {tCommon("feed.follower", { count: followers })}
              </div>
            )
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={() => follow({ isList: false, id: feed.id, url: feed.url })}
        className={cn(
          "h-7 shrink-0 rounded-full px-3.5 text-xs font-bold transition-colors",
          isSubscribed
            ? "border border-border bg-background text-text-secondary"
            : "bg-accent text-accent-fg hover:opacity-90",
        )}
      >
        {isSubscribed ? t("feed.actions.followed") : t("feed.actions.follow")}
      </button>
    </div>
  )
}
