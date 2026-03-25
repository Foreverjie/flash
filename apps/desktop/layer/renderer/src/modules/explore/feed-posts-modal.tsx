import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Button } from "@follow/components/ui/button/index.js"
import { Input } from "@follow/components/ui/input/index.js"
import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import { PresentSheet } from "@follow/components/ui/sheet/Sheet.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import type { MouseEvent, ReactNode } from "react"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useCurrentModal, useModalStack } from "~/components/ui/modal/stacked/hooks"
import { PostDetailContent } from "~/modules/public-timeline/post-detail"
import type { FeedItem } from "~/queries/feeds"
import {
  useSubscribeFeedMutation,
  useUnsubscribeFeedMutation,
  useUserSubscriptionsQuery,
} from "~/queries/feeds"
import type { PostItem } from "~/queries/posts"
import { usePostsQuery } from "~/queries/posts"

function DesktopModalSurface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-border/70 bg-theme-background shadow-[0_40px_140px_rgba(15,23,42,0.3)]",
        className,
      )}
    >
      {children}
    </div>
  )
}

// Wrapper so useCurrentModal() resolves to Post Detail Modal (layer 2)
function PostDetailModalContent({ postId }: { postId: string }) {
  const { dismiss } = useCurrentModal()
  return (
    <DesktopModalSurface className="h-[min(90vh,980px)] w-[min(1180px,calc(100vw-4rem))]">
      <PostDetailContent postId={postId} onClose={dismiss} variant="modal" />
    </DesktopModalSurface>
  )
}

const POST_FILTERS = [
  { key: "all", labelKey: "explore.filter_all", defaultLabel: "Everything" },
  { key: "media", labelKey: "explore.filter_media", defaultLabel: "With media" },
] as const

const SORTS = [
  { key: "newest", labelKey: "explore.sort_latest", defaultLabel: "Latest" },
  { key: "oldest", labelKey: "explore.sort_oldest", defaultLabel: "Oldest" },
] as const

type FeedPostFilter = (typeof POST_FILTERS)[number]["key"]
type FeedPostSort = (typeof SORTS)[number]["key"]

function stripHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

function formatRelativeTime(dateStr: string | null) {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString()
}

export const FeedPostItem = memo(
  ({ post, onSelect }: { post: PostItem; onSelect: (post: PostItem) => void }) => {
    const { t } = useTranslation()
    const thumbnail = post.media?.find((m) => m.type === "image")
    const categories = post.categories?.slice(0, 2) ?? []
    const description = post.description ? stripHtml(post.description) : null

    const handleOpenOriginal = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        if (post.url) {
          window.open(post.url, "_blank", "noopener,noreferrer")
        }
      },
      [post.url],
    )

    return (
      <div
        className={cn(
          "group relative flex cursor-pointer gap-3 rounded-2xl border border-transparent bg-fill-quaternary/80 p-3",
          "transition-all duration-200 hover:-translate-y-0.5 hover:border-fill-secondary hover:bg-material-ultra-thin",
        )}
        onClick={() => onSelect(post)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="line-clamp-1 text-sm font-semibold text-text">
              {post.title || "Untitled"}
            </h4>
            {post.url && (
              <button
                type="button"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={handleOpenOriginal}
                title={t("explore.open_original", { defaultValue: "Open original" })}
              >
                <i className="i-mgc-external-link-cute-re text-xs text-text-tertiary" />
              </button>
            )}
          </div>
          {description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
              {description}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
            {post.author && <span className="truncate">{post.author}</span>}
            {post.author && post.publishedAt && <span className="text-text-quaternary">·</span>}
            {post.publishedAt && <time>{formatRelativeTime(post.publishedAt)}</time>}
          </div>
          {categories.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-fill-tertiary px-2 py-0.5 text-[10px] text-text-tertiary"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
        </div>
        {thumbnail && (
          <img
            src={thumbnail.url}
            alt=""
            className="size-[72px] shrink-0 rounded-xl object-cover"
            loading="lazy"
          />
        )}
      </div>
    )
  },
)

function FeedPostsModalBody({ feed, followButton }: { feed: FeedItem; followButton: ReactNode }) {
  const { t } = useTranslation()
  const isMobile = useMobile()
  const { present } = useModalStack()
  const [activePostId, setActivePostId] = useState<string | null>(null)

  const [allPosts, setAllPosts] = useState<PostItem[]>([])
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<FeedPostFilter>("all")
  const [sort, setSort] = useState<FeedPostSort>("newest")
  const [search, setSearch] = useState("")
  const { data, isLoading } = usePostsQuery(page, 20, feed.id)

  useEffect(() => {
    if (data?.data) {
      setAllPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newPosts = data.data.filter((p: PostItem) => !existingIds.has(p.id))
        return [...prev, ...newPosts]
      })
    }
  }, [data])

  const handleSelectPost = useCallback(
    (post: PostItem) => {
      if (isMobile) {
        setActivePostId(post.id)
        return
      }
      present({
        CustomModalComponent: PlainModal,
        title: "",
        content: () => <PostDetailModalContent postId={post.id} />,
        clickOutsideToDismiss: true,
        modalContainerClassName: "flex items-start justify-center overflow-auto pt-[4vh]",
        modalContentClassName: "h-full",
      })
    },
    [isMobile, present],
  )

  const filteredPosts = useMemo(() => {
    const base =
      filter === "media"
        ? allPosts.filter((post) => post.media?.some((m) => m.type === "image"))
        : allPosts
    const query = search.trim().toLowerCase()
    const searched = query
      ? base.filter((post) => {
          const haystack =
            `${post.title ?? ""} ${post.description ?? ""} ${post.author ?? ""}`.toLowerCase()
          return haystack.includes(query)
        })
      : base
    if (sort === "oldest") {
      return [...searched].reverse()
    }
    return searched
  }, [allPosts, filter, search, sort])

  const hasMore = data?.hasMore ?? true
  const showEmptyState = !isLoading && filteredPosts.length === 0

  const handleOpenFeedSite = useCallback(() => {
    const url = feed.siteUrl || feed.url
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  }, [feed.siteUrl, feed.url])

  return (
    <>
      <div
        className={cn(
          "flex h-full min-h-0 flex-col overflow-hidden bg-theme-background",
          isMobile && "rounded-[28px] border border-border/70",
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(255,92,0,0.12), transparent 28%), radial-gradient(circle at top right, rgba(14,165,233,0.1), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 22%)",
          }}
        />
        {/* Feed header */}
        <div className="relative flex items-start gap-3 border-b border-border/80 bg-theme-background px-5 py-4 backdrop-blur-xl">
          <div className="shrink-0">
            {feed.image ? (
              <img
                src={feed.image}
                alt=""
                className="size-12 rounded-xl object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-xl bg-fill-tertiary">
                <i className="i-mgc-rss-cute-fi text-lg text-text-quaternary" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold text-text">
                {feed.title || feed.url}
              </h3>
              {feed.siteUrl && (
                <span className="rounded-full bg-fill-tertiary/70 px-2 py-0.5 text-[11px] text-text-tertiary">
                  {new URL(feed.siteUrl).hostname}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-text-quaternary">
              {feed.subscriptionCount != null && (
                <span>
                  {t("explore.subscribers_count", {
                    defaultValue: "{{count}} subscribers",
                    count: feed.subscriptionCount,
                  })}
                </span>
              )}
              {feed.language && (
                <span className="inline-flex items-center gap-1">
                  <i className="i-mgc-translate-cute-re" />
                  {feed.language.toUpperCase()}
                </span>
              )}
              {feed.lastFetchedAt && (
                <span>
                  {t("explore.fetched_at", {
                    defaultValue: "Updated {{time}}",
                    time: new Date(feed.lastFetchedAt).toLocaleDateString(),
                  })}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              {(feed.siteUrl || feed.url) && (
                <Button variant="ghost" buttonClassName="text-xs" onClick={handleOpenFeedSite}>
                  <i className="i-mgc-external-link-cute-re mr-1" />
                  {t("explore.visit_site", { defaultValue: "Visit site" })}
                </Button>
              )}
              {followButton}
            </div>
            {feed.subscriptionCount != null && (
              <span className="text-[11px] text-text-tertiary">
                {t("explore.followers_short", {
                  defaultValue: "{{count}} followers",
                  count: feed.subscriptionCount,
                })}
              </span>
            )}
          </div>
        </div>

        <div className="relative border-b border-border/70 bg-fill-quinary/55 px-5 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {POST_FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    filter === item.key
                      ? "bg-theme-background text-text"
                      : "bg-fill-tertiary text-text-tertiary hover:text-text",
                  )}
                >
                  {t(item.labelKey, { defaultValue: item.defaultLabel })}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1 rounded-full bg-fill-tertiary px-2 py-1 text-[11px] text-text-secondary">
              {SORTS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSort(item.key)}
                  className={cn(
                    "rounded-full px-2 py-0.5 transition-colors",
                    sort === item.key ? "bg-theme-background text-text" : "text-text-tertiary",
                  )}
                >
                  {t(item.labelKey, { defaultValue: item.defaultLabel })}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1">
              <i className="i-mgc-search-3-cute-re pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("explore.search_posts", { defaultValue: "Search within this feed" })}
                className="pl-9"
              />
            </div>
            <span className="text-[12px] text-text-tertiary">
              {filteredPosts.length} {t("words.posts", { defaultValue: "posts" })}
            </span>
          </div>
        </div>

        {/* Scrollable post list */}
        <ScrollArea.ScrollArea rootClassName="relative h-0 grow" viewportClassName="px-4 py-4">
          {allPosts.length === 0 && isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
              ))}
            </div>
          ) : showEmptyState ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <i className="i-mgc-search-3-cute-re text-3xl" />
              <p className="mt-3 text-center text-sm">
                {search
                  ? t("explore.no_posts_match", { defaultValue: "Nothing matched your filters" })
                  : t("explore.no_posts", { defaultValue: "No posts yet" })}
              </p>
            </div>
          ) : (
            <>
              {filteredPosts.map((post) => (
                <FeedPostItem key={post.id} post={post} onSelect={handleSelectPost} />
              ))}
              {hasMore && (
                <div className="py-4 text-center">
                  <Button
                    variant="outline"
                    buttonClassName="text-xs"
                    disabled={isLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {isLoading ? (
                      <i className="i-mgc-loading-3-cute-re animate-spin" />
                    ) : (
                      t("explore.load_more", { defaultValue: "Load more" })
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </ScrollArea.ScrollArea>
      </div>

      {isMobile && (
        <PresentSheet
          open={!!activePostId}
          onOpenChange={(open) => {
            if (!open) {
              setActivePostId(null)
            }
          }}
          title=""
          hideHeader
          modalClassName="border-t border-border bg-theme-background pt-3"
          contentClassName="min-h-0 px-0 pb-safe-offset-4"
          content={
            activePostId ? (
              <PostDetailContent postId={activePostId} onClose={() => setActivePostId(null)} />
            ) : null
          }
        />
      )}
    </>
  )
}

function AuthenticatedFeedPostsModalBody({ feed }: { feed: FeedItem }) {
  const { t } = useTranslation()
  const user = useWhoami()
  const { data: subscriptions } = useUserSubscriptionsQuery(!!user)
  const subscribedFeedIds = useMemo(
    () => new Set(subscriptions?.map((s) => s.feedId) ?? []),
    [subscriptions],
  )
  const isSubscribed = subscribedFeedIds.has(feed.id)

  const subscribeMutation = useSubscribeFeedMutation()
  const unsubscribeMutation = useUnsubscribeFeedMutation()
  const isPending = subscribeMutation.isPending || unsubscribeMutation.isPending

  const handleToggleSubscribe = useCallback(() => {
    if (isSubscribed) {
      unsubscribeMutation.mutate(feed.id, {
        onSuccess: () => {
          toast.success(t("explore.unsubscribed", { defaultValue: "Unsubscribed" }))
        },
        onError: () => {
          toast.error(t("explore.unsubscribe_failed", { defaultValue: "Failed to unsubscribe" }))
        },
      })
    } else {
      subscribeMutation.mutate(feed.id, {
        onSuccess: () => {
          toast.success(t("explore.subscribed", { defaultValue: "Subscribed!" }))
        },
        onError: () => {
          toast.error(t("explore.subscribe_failed", { defaultValue: "Failed to subscribe" }))
        },
      })
    }
  }, [isSubscribed, feed.id, subscribeMutation, unsubscribeMutation, t])

  const followButton = (
    <Button
      variant={isSubscribed ? "outline" : "primary"}
      buttonClassName="text-xs"
      disabled={isPending}
      onClick={handleToggleSubscribe}
    >
      {isPending ? (
        <i className="i-mgc-loading-3-cute-re animate-spin" />
      ) : isSubscribed ? (
        t("explore.following", { defaultValue: "Following" })
      ) : (
        t("explore.follow", { defaultValue: "Follow" })
      )}
    </Button>
  )

  return <FeedPostsModalBody feed={feed} followButton={followButton} />
}

export function FeedPostsModal({ feed }: { feed: FeedItem }) {
  const user = useWhoami()
  const content = user ? (
    <AuthenticatedFeedPostsModalBody feed={feed} />
  ) : (
    <FeedPostsModalBody feed={feed} followButton={null} />
  )

  if (useMobile()) {
    return content
  }

  return (
    <DesktopModalSurface className="h-[min(88vh,920px)] w-[min(1120px,calc(100vw-4rem))]">
      {content}
    </DesktopModalSurface>
  )
}
