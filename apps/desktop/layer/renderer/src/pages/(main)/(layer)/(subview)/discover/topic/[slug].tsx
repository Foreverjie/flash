import { Button } from "@follow/components/ui/button/index.js"
import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { LoadingCircle } from "@follow/components/ui/loading/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useIsSubscribed } from "@follow/store/subscription/hooks"
import { cn, formatNumber } from "@follow/utils/utils"
import { useTranslation } from "react-i18next"
import { useLocation, useParams } from "react-router"

import { useFollow } from "~/hooks/biz/useFollow"
import { navigateEntry } from "~/hooks/biz/useNavigateEntry"
import { useSubViewTitle } from "~/modules/app-layout/subview/hooks"
import { FeedIcon } from "~/modules/feed/feed-icon"
import type { FeedItem } from "~/queries/feeds"
import { useTopicFeedsQuery, useTopicsQuery } from "~/queries/topics"

export const Component = () => {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const slug = useParams().slug as string
  const topics = useTopicsQuery()
  const topic = topics.data?.find((item) => item.slug === slug)
  const title = topic?.label ?? slug

  useSubViewTitle(<span>{title}</span>, title)

  const { data: feeds, isError, isLoading, refetch } = useTopicFeedsQuery(slug)

  return (
    <div className="w-full max-w-screen-sm px-4 pb-10">
      <header className="mb-6 mt-2 text-center">
        {topics.isLoading ? (
          <Skeleton className="mx-auto h-8 w-40 rounded-lg" />
        ) : (
          <>
            <h1
              className="m-0 text-[28px] font-semibold leading-tight text-text"
              style={topic?.color ? { color: topic.color } : undefined}
            >
              {title}
            </h1>
            {topic?.description && (
              <p className="m-0 mt-1.5 text-sm leading-snug text-text-secondary">
                {topic.description}
              </p>
            )}
          </>
        )}
      </header>

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
        <div className="flex flex-col">
          {feeds.map((feed) => (
            <TopicFeedRow key={feed.id} feed={feed} />
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
  )
}

function TopicFeedRow({ feed }: { feed: FeedItem }) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const location = useLocation()
  const follow = useFollow()
  const isSubscribed = useIsSubscribed(feed.id)
  const followers = feed.subscriptionCount ?? 0

  return (
    <div className="flex items-center gap-3 border-b border-border-secondary py-2.5 last:border-b-0">
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
        <FeedIcon target={{ ...feed, type: "feed" }} size={36} className="shrink-0" noMargin />
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
        onClick={() =>
          follow({
            isList: false,
            id: feed.id,
            url: feed.url,
          })
        }
        className={cn(
          "h-7 shrink-0 rounded-full px-3.5 text-xs font-semibold transition-colors",
          isSubscribed
            ? "bg-brand-accent text-[var(--fo-accent-fg)]"
            : "border border-border bg-background text-text active:bg-fill",
        )}
      >
        {isSubscribed ? t("feed.actions.followed") : t("feed.actions.follow")}
      </button>
    </div>
  )
}
