import { cn } from "@follow/utils/utils"
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

export const PostCard = memo(({ post }: { post: PostItem }) => {
  const firstMedia = post.media?.[0]
  const hasImage = firstMedia?.type === "image"
  const imageUrl = hasImage ? firstMedia.url : null
  const description = post.description ? stripHtml(post.description) : null

  const handleClick = useCallback(() => {
    if (post.url) {
      window.open(post.url, "_blank", "noopener,noreferrer")
    }
  }, [post.url])

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer gap-4 rounded-xl p-4",
        "bg-fill-quaternary transition-colors duration-150",
        "hover:bg-fill-tertiary",
      )}
      onClick={handleClick}
    >
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Feed info */}
        <div className="flex items-center gap-2">
          {post.feedImage ? (
            <img
              src={post.feedImage}
              alt=""
              className="size-4 rounded-sm object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-4 items-center justify-center rounded-sm bg-fill-tertiary">
              <i className="i-mgc-rss-cute-fi text-[10px] text-text-quaternary" />
            </div>
          )}
          <span className="truncate text-xs font-medium text-text-secondary">
            {post.feedTitle || "Unknown Feed"}
          </span>
          {post.author && (
            <>
              <span className="text-xs text-text-quaternary">·</span>
              <span className="truncate text-xs text-text-tertiary">{post.author}</span>
            </>
          )}
          <span className="ml-auto shrink-0 text-xs text-text-quaternary">
            {formatRelativeTime(post.publishedAt)}
          </span>
        </div>

        {/* Title */}
        {post.title && (
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-text">
            {post.title}
          </h3>
        )}

        {/* Description */}
        {description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-text-tertiary">{description}</p>
        )}

        {/* Categories */}
        {post.categories && post.categories.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {post.categories.slice(0, 3).map((cat) => (
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

      {/* Thumbnail */}
      {imageUrl && (
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg">
          <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
        </div>
      )}

      {/* External link indicator */}
      {post.url && (
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
          <i className="i-mgc-external-link-cute-re text-xs text-text-quaternary" />
        </div>
      )}
    </div>
  )
})
