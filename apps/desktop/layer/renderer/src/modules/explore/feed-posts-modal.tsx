import { Button } from "@follow/components/ui/button/index.js"
import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import type { ReactNode } from "react"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

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

// Wrapper so useCurrentModal() resolves to Post Detail Modal (layer 2)
function PostDetailModalContent({ postId }: { postId: string }) {
  const { dismiss } = useCurrentModal()
  return <PostDetailContent postId={postId} onClose={dismiss} />
}

export const FeedPostItem = memo(
  ({ post, onSelect }: { post: PostItem; onSelect: (post: PostItem) => void }) => {
    const thumbnail = post.media?.find((m) => m.type === "image")

    return (
      <div
        className={cn(
          "flex cursor-pointer gap-3 rounded-lg p-3",
          "transition-colors duration-150",
          "hover:bg-fill-tertiary",
        )}
        onClick={() => onSelect(post)}
      >
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-1 text-sm font-semibold text-text">
            {post.title || "Untitled"}
          </h4>
          {post.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-tertiary">
              {post.description.replaceAll(/<[^>]*>/g, "")}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-quaternary">
            {post.author && <span className="truncate">{post.author}</span>}
            {post.author && post.publishedAt && <span>·</span>}
            {post.publishedAt && <time>{new Date(post.publishedAt).toLocaleDateString()}</time>}
          </div>
        </div>
        {thumbnail && (
          <img
            src={thumbnail.url}
            alt=""
            className="size-[60px] shrink-0 rounded-md object-cover"
            loading="lazy"
          />
        )}
      </div>
    )
  },
)

function FeedPostsModalBody({ feed, followButton }: { feed: FeedItem; followButton: ReactNode }) {
  const { t } = useTranslation()
  const { present } = useModalStack()

  const [allPosts, setAllPosts] = useState<PostItem[]>([])
  const [page, setPage] = useState(1)
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
      present({
        title: post.title || "Post",
        content: () => <PostDetailModalContent postId={post.id} />,
        clickOutsideToDismiss: true,
        modalClassName: "relative mx-auto mt-[10vh] max-h-[80vh] max-w-3xl overflow-hidden",
      })
    },
    [present],
  )

  const hasMore = data?.hasMore ?? true

  return (
    <div className="flex max-h-[80vh] flex-col">
      {/* Feed header */}
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="shrink-0">
          {feed.image ? (
            <img
              src={feed.image}
              alt=""
              className="size-11 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-lg bg-fill-tertiary">
              <i className="i-mgc-rss-cute-fi text-lg text-text-quaternary" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text">{feed.title || feed.url}</h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-quaternary">
            {feed.siteUrl && <span>{new URL(feed.siteUrl).hostname}</span>}
            {feed.subscriptionCount != null && (
              <span>
                {t("explore.subscribers_count", {
                  defaultValue: "{{count}} subscribers",
                  count: feed.subscriptionCount,
                })}
              </span>
            )}
          </div>
        </div>
        {followButton}
      </div>

      {/* Scrollable post list */}
      <ScrollArea.ScrollArea rootClassName="h-0 grow" viewportClassName="p-2">
        {allPosts.length === 0 && isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
            ))}
          </div>
        ) : allPosts.length === 0 && !isLoading && data ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
            <i className="i-mgc-document-cute-re text-3xl" />
            <p className="mt-3 text-sm">
              {t("explore.no_posts", { defaultValue: "No posts yet" })}
            </p>
          </div>
        ) : (
          <>
            {allPosts.map((post) => (
              <FeedPostItem key={post.id} post={post} onSelect={handleSelectPost} />
            ))}
            {hasMore && (
              <div className="py-3 text-center">
                <Button
                  variant="ghost"
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
  return user ? (
    <AuthenticatedFeedPostsModalBody feed={feed} />
  ) : (
    <FeedPostsModalBody feed={feed} followButton={null} />
  )
}
