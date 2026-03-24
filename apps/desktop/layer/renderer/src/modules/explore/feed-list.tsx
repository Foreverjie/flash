import { Button } from "@follow/components/ui/button/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { memo, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import type { FeedItem } from "~/queries/feeds"
import {
  usePublicFeedsQuery,
  useSubscribeFeedMutation,
  useUnsubscribeFeedMutation,
  useUserSubscriptionsQuery,
} from "~/queries/feeds"

import { FeedPostsModal } from "./feed-posts-modal"

export function FeedList() {
  const { t } = useTranslation()
  const user = useWhoami()
  const isAuthenticated = !!user

  const { data, isLoading } = usePublicFeedsQuery()
  const { data: subscriptions } = useUserSubscriptionsQuery(isAuthenticated)

  const subscribedFeedIds = useMemo(
    () => new Set(subscriptions?.map((s) => s.feedId) ?? []),
    [subscriptions],
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!data?.data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
        <i className="i-mgc-rss-cute-re text-4xl" />
        <p className="mt-4 text-sm">
          {t("explore.no_feeds", { defaultValue: "No feeds available yet." })}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-right text-sm text-text-secondary">{data.total} feeds</div>
      {data.data.map((feed) => (
        <FeedCard
          key={feed.id}
          feed={feed}
          isSubscribed={subscribedFeedIds.has(feed.id)}
          isAuthenticated={isAuthenticated}
        />
      ))}
    </div>
  )
}

const FeedCard = memo(
  ({
    feed,
    isSubscribed,
    isAuthenticated,
  }: {
    feed: FeedItem
    isSubscribed: boolean
    isAuthenticated: boolean
  }) => {
    const { t } = useTranslation()
    const subscribeMutation = useSubscribeFeedMutation()
    const unsubscribeMutation = useUnsubscribeFeedMutation()

    const isPending = subscribeMutation.isPending || unsubscribeMutation.isPending

    const handleToggleSubscribe = useCallback(() => {
      if (!isAuthenticated) {
        toast.error(t("explore.login_to_subscribe", { defaultValue: "Please login to subscribe" }))
        return
      }
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
    }, [feed.id, isAuthenticated, isSubscribed, subscribeMutation, unsubscribeMutation, t])

    const { present } = useModalStack()

    const handleOpenPosts = useCallback(() => {
      present({
        title: feed.title || "Feed Posts",
        content: () => <FeedPostsModal feed={feed} />,
        clickOutsideToDismiss: true,
        modalClassName: "relative mx-auto mt-[10vh] max-h-[80vh] max-w-2xl overflow-hidden",
      })
    }, [present, feed])

    const handleOpenSite = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        const url = feed.siteUrl || feed.url
        if (url) {
          window.open(url, "_blank", "noopener,noreferrer")
        }
      },
      [feed.siteUrl, feed.url],
    )

    return (
      <div
        className={cn(
          "group relative flex cursor-pointer items-start gap-4 rounded-xl p-4",
          "bg-fill-quaternary transition-colors duration-150",
          "hover:bg-fill-tertiary",
        )}
        onClick={handleOpenPosts}
      >
        {/* Feed icon */}
        <div className="shrink-0">
          {feed.image ? (
            <img
              src={feed.image}
              alt=""
              className="size-10 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-fill-tertiary">
              <i className="i-mgc-rss-cute-fi text-lg text-text-quaternary" />
            </div>
          )}
        </div>

        {/* Feed info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text">{feed.title || feed.url}</h3>
          {feed.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-text-tertiary">
              {feed.description}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-3 text-xs text-text-quaternary">
            {feed.siteUrl && <span className="truncate">{new URL(feed.siteUrl).hostname}</span>}
            {feed.language && <span>{feed.language}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {(feed.siteUrl || feed.url) && (
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-fill-tertiary hover:text-text-secondary"
              onClick={handleOpenSite}
              title={t("explore.open_site", { defaultValue: "Open site" })}
            >
              <i className="i-mgc-external-link-cute-re text-sm" />
            </button>
          )}
          <Button
            variant={isSubscribed ? "outline" : "primary"}
            buttonClassName="text-xs"
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation()
              handleToggleSubscribe()
            }}
          >
            {isPending ? (
              <i className="i-mgc-loading-3-cute-re animate-spin" />
            ) : isSubscribed ? (
              t("explore.following", { defaultValue: "Following" })
            ) : (
              t("explore.follow", { defaultValue: "Follow" })
            )}
          </Button>
        </div>
      </div>
    )
  },
)
