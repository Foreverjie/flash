import { ActionButton, Button } from "@follow/components/ui/button/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { cn } from "@follow/utils/utils"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { SimpleDiscoverModal } from "~/modules/subscription-column/SimpleDiscoverModal"
import type { FeedItem } from "~/queries/feeds"
import { usePublicFeedsQuery } from "~/queries/feeds"
import type { PostItem } from "~/queries/posts"
import { usePostsQuery } from "~/queries/posts"

import { FeedList } from "./feed-list"
import { PostCard } from "./post-card"

type ExploreTab = "feeds" | "posts"

export function Explore() {
  const { t } = useTranslation()
  const { present } = useModalStack()
  const [activeTab, setActiveTab] = useState<ExploreTab>("feeds")
  const [page, setPage] = useState(1)
  const limit = 30

  const { data: feedSummary } = usePublicFeedsQuery()
  const { data, isLoading, isFetching, refetch } = usePostsQuery(page, limit)

  const heroStats = useMemo(() => {
    const totalFeeds = feedSummary?.total
    const totalPosts = data?.total
    const languageCount = feedSummary?.data
      ? new Set(feedSummary.data.map((feed: FeedItem) => feed.language).filter(Boolean)).size
      : null

    return [
      {
        label: t("explore.hero_curated", { defaultValue: "Curated Feeds" }),
        value: totalFeeds ? totalFeeds.toLocaleString() : "–",
      },
      {
        label: t("explore.hero_latest", { defaultValue: "Latest Posts" }),
        value: totalPosts ? totalPosts.toLocaleString() : "–",
      },
      {
        label: t("explore.hero_languages", { defaultValue: "Active Languages" }),
        value: languageCount ? languageCount.toLocaleString() : "–",
      },
    ]
  }, [data?.total, feedSummary?.data, feedSummary?.total, t])

  const handleRefresh = useCallback(() => {
    setPage(1)
    refetch()
  }, [refetch])

  const handleOpenDiscover = useCallback(() => {
    present({
      id: "explore-discover-modal",
      title: t("discover.find_feeds_title", { defaultValue: "Add new feeds" }),
      content: ({ dismiss }) => <SimpleDiscoverModal dismiss={dismiss} />,
      clickOutsideToDismiss: true,
      modalClassName: "relative mx-auto mt-[8vh] max-h-[80vh] max-w-3xl overflow-hidden",
    })
  }, [present, t])

  return (
    <div className="mx-auto mt-4 w-full max-w-[800px] space-y-6 pb-12">
      <div className="relative overflow-hidden rounded-3xl border border-material-medium bg-material-ultra-thick p-6 shadow-[0_30px_80px_rgba(15,15,15,0.35)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(255,92,0,0.35), transparent 55%), radial-gradient(circle at 80% 20%, rgba(0,122,255,0.25), transparent 45%)",
          }}
        />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xl font-semibold">
            <span className="flex items-center gap-2">
              <i className="i-mgc-world-2-cute-re text-2xl text-text" />
              {t("words.explore")}
            </span>
            <span className="rounded-full bg-fill-tertiary/80 px-3 py-1 text-xs font-normal text-text-secondary">
              {t("explore.hero_subtitle", { defaultValue: "Preview feeds before subscribing" })}
            </span>
          </div>
          <p className="max-w-2xl text-sm text-text-secondary">
            {t("explore.hero_description", {
              defaultValue:
                "Browse curated collections, peek into real timelines, and follow only what stays inspiring.",
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={handleOpenDiscover}>
              <i className="i-mgc-add-cute-re mr-2" />
              {t("discover.add_feed", { defaultValue: "Add feeds" })}
            </Button>
            <Button variant="ghost" onClick={handleRefresh}>
              <i className="i-mgc-refresh-cute-re mr-2" />
              {t("words.refresh", { defaultValue: "Refresh posts" })}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-fill-secondary/80 bg-material-ultra-thin px-4 py-3"
              >
                <p className="text-xs text-text-tertiary">{stat.label}</p>
                <p className="text-2xl font-semibold text-text">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-fill-tertiary bg-material-ultra-thin p-1">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "feeds"
              ? "bg-theme-background text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              : "text-text-secondary hover:text-text",
          )}
          onClick={() => setActiveTab("feeds")}
        >
          <i className="i-mgc-rss-cute-re mr-1.5" />
          {t("words.feeds", { defaultValue: "Feeds" })}
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all",
            activeTab === "posts"
              ? "bg-theme-background text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
              : "text-text-secondary hover:text-text",
          )}
          onClick={() => {
            setActiveTab("posts")
            setPage(1)
          }}
        >
          <i className="i-mgc-news-cute-re mr-1.5" />
          {t("words.posts", { defaultValue: "Posts" })}
        </button>
      </div>

      {activeTab === "feeds" ? (
        <FeedList />
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              {data
                ? t("explore.posts_counter", { defaultValue: "{{count}} posts", count: data.total })
                : t("explore.posts_loading", { defaultValue: "Fetching latest posts" })}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-fill-tertiary/60 px-3 py-1 text-[11px] font-medium text-text-secondary transition-colors hover:text-text"
              onClick={handleRefresh}
            >
              <i className="i-mgc-refresh-cute-re text-base" />
              {t("words.refresh", { defaultValue: "Refresh" })}
            </button>
          </div>

          <div className="space-y-3">
            {isLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[120px] w-full rounded-lg" />
                ))
              : data?.data.map((post: PostItem) => <PostCard key={post.id} post={post} />)}
          </div>

          {data && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <ActionButton
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                tooltip="Previous"
              >
                <i className="i-mgc-left-cute-fi" />
              </ActionButton>

              <span className="text-sm text-text-secondary">
                {page} / {Math.ceil(data.total / limit)}
              </span>

              <ActionButton
                disabled={!data.hasMore || isFetching}
                onClick={() => setPage((p) => p + 1)}
                tooltip="Next"
              >
                <i className="i-mgc-right-cute-re" />
              </ActionButton>
            </div>
          )}

          {!isLoading && data?.data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
              <i className="i-mgc-inbox-cute-re text-4xl" />
              <p className="mt-4 text-sm">No posts yet. Feeds will be synced automatically.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
