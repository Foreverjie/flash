import { cn } from "@follow/utils/utils"
import { m } from "motion/react"
import { memo, useCallback } from "react"

import type { PostItem } from "~/queries/posts"

function formatRelativeTime(dateStr: string | null): string {
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

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return doc.body.textContent || ""
}

/**
 * A single entry item with thread line, active state, and in-app detail selection.
 */
export const PublicEntryItem = memo(
  ({
    post,
    isActive,
    onSelect,
  }: {
    post: PostItem
    isActive: boolean
    onSelect: (postId: string) => void
  }) => {
    const firstMedia = post.media?.[0]
    const hasImage = firstMedia?.type === "image"
    const imageUrl = hasImage ? firstMedia.url : null
    const description = post.description ? stripHtml(post.description) : null

    const handleClick = useCallback(() => {
      onSelect(post.id)
    }, [post.id, onSelect])

    return (
      <m.div
        className={cn(
          "group relative flex cursor-pointer py-4 pl-6 pr-2",
          "transition-colors duration-200",
          isActive ? "bg-theme-item-active" : "hover:bg-theme-item-hover",
        )}
        onClick={handleClick}
        whileHover={{ x: isActive ? 0 : 2 }}
        transition={{ type: "spring", duration: 0.2, bounce: 0 }}
      >
        {/* Thread line dot */}
        <div
          className={cn(
            "absolute left-[7px] top-[22px] z-[1] size-2.5 rounded-full border-2 border-theme-background",
            isActive ? "bg-theme-accent" : "bg-border",
          )}
        />

        {/* Feed icon */}
        {post.feedImage ? (
          <img
            src={post.feedImage}
            alt=""
            className="mr-2 size-5 shrink-0 rounded-sm object-cover"
            loading="lazy"
          />
        ) : (
          <div className="mr-2 flex size-5 shrink-0 items-center justify-center rounded-sm bg-fill-tertiary">
            <i className="i-mgc-rss-cute-fi text-[10px] text-text-quaternary" />
          </div>
        )}

        {/* Text content */}
        <div className="-mt-0.5 min-w-0 flex-1 text-sm leading-tight">
          {/* Meta line: feed title · time */}
          <div className="flex gap-1 text-[10px] font-bold text-text-secondary">
            <span className="truncate">{post.feedTitle || "Unknown Feed"}</span>
            {post.author && (
              <>
                <span className="text-text-quaternary">·</span>
                <span className="truncate text-text-tertiary">{post.author}</span>
              </>
            )}
            <span className="text-text-quaternary">·</span>
            <span className="shrink-0">{formatRelativeTime(post.publishedAt)}</span>
          </div>

          {/* Title */}
          {post.title && (
            <div className="relative my-0.5 line-clamp-2 break-words font-medium text-text">
              {post.title}
            </div>
          )}

          {/* Description */}
          {description && (
            <div className="line-clamp-2 text-[13px] text-text-secondary">{description}</div>
          )}
        </div>

        {/* Thumbnail */}
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="ml-2 size-20 shrink-0 rounded object-cover"
            loading="lazy"
          />
        )}
      </m.div>
    )
  },
)
