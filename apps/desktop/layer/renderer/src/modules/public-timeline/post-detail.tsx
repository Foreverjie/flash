import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { cn } from "@follow/utils/utils"
import { AnimatePresence, m } from "motion/react"
import { useCallback, useMemo } from "react"

import { usePostDetailQuery } from "~/queries/posts"

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ""
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Detail panel showing full post content.
 * Renders as third column on desktop or inside PresentSheet on mobile.
 */
export function PostDetailPanel({
  postId,
  onClose,
}: {
  postId: string | null
  onClose: () => void
}) {
  return (
    <AnimatePresence mode="popLayout">
      {postId ? (
        <m.div
          key={postId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ type: "spring", duration: 0.35, bounce: 0 }}
          className="flex h-full min-w-0 flex-1 flex-col"
        >
          <PostDetailContent postId={postId} onClose={onClose} />
        </m.div>
      ) : (
        <m.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-full min-w-0 flex-1 items-center justify-center"
        >
          <div className="text-center text-text-tertiary">
            <i className="i-mgc-document-cute-re text-4xl" />
            <p className="mt-3 text-sm">Select a post to read</p>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Inner content for detail panel, also used by mobile sheet.
 */
export function PostDetailContent({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { data: post, isLoading } = usePostDetailQuery(postId)

  const handleOpenExternal = useCallback(() => {
    if (post?.url) {
      window.open(post.url, "_blank", "noopener,noreferrer")
    }
  }, [post?.url])

  const htmlContent = useMemo(() => {
    if (!post) return null
    const html = post.formattedContent?.html
    if (html) return html
    if (post.content) return post.content
    if (post.description) return post.description
    return null
  }, [post])

  const images = useMemo(() => post?.media?.filter((m) => m.type === "image") ?? [], [post?.media])

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (!post) {
    return (
      <div className="flex h-full items-center justify-center text-text-tertiary">
        <p className="text-sm">Post not found</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-border bg-theme-background px-5 py-3">
        <div className="flex items-start gap-3">
          {/* Feed icon */}
          {post.feedImage ? (
            <img
              src={post.feedImage}
              alt=""
              className="mt-0.5 size-5 shrink-0 rounded-sm object-cover"
              loading="lazy"
            />
          ) : (
            <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm bg-fill-tertiary">
              <i className="i-mgc-rss-cute-fi text-[10px] text-text-quaternary" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {post.title && (
              <h1 className="text-lg font-bold leading-snug text-text">{post.title}</h1>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
              <span className="font-medium">{post.feedTitle || "Unknown Feed"}</span>
              {post.author && (
                <>
                  <span className="text-text-quaternary">·</span>
                  <span>{post.author}</span>
                </>
              )}
              {post.publishedAt && (
                <>
                  <span className="text-text-quaternary">·</span>
                  <span>{formatDate(post.publishedAt)}</span>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {post.url && (
              <button
                type="button"
                className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-theme-item-hover hover:text-text"
                onClick={handleOpenExternal}
                title="Open original"
              >
                <i className="i-mgc-external-link-cute-re text-base" />
              </button>
            )}
            <button
              type="button"
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-theme-item-hover hover:text-text"
              onClick={onClose}
              title="Close"
            >
              <i className="i-mgc-close-cute-re text-base" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <ScrollArea.ScrollArea rootClassName="h-0 grow" viewportClassName="px-5">
        <article className="mx-auto max-w-prose pb-12 pt-5">
          {/* Image gallery */}
          {images.length > 0 && (
            <div
              className={cn("mb-5 grid gap-2", images.length === 1 ? "grid-cols-1" : "grid-cols-2")}
            >
              {images.map((img) => (
                <img
                  key={img.url}
                  src={img.url}
                  alt=""
                  className="w-full rounded-lg object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {/* HTML content */}
          {htmlContent ? (
            <div
              className="prose prose-neutral max-w-none text-base leading-relaxed dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          ) : (
            <p className="text-sm italic text-text-tertiary">No content available</p>
          )}

          {/* Categories */}
          {post.categories && post.categories.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
              {post.categories.map((cat) => (
                <span
                  key={cat}
                  className="rounded-full bg-fill-tertiary px-2.5 py-0.5 text-xs text-text-secondary"
                >
                  {cat}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          {post.url && (
            <div className="mt-8 border-t border-border pt-4">
              <a
                href={post.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-theme-accent inline-flex items-center gap-1.5 text-sm hover:underline"
              >
                <i className="i-mgc-external-link-cute-re" />
                Read original article
              </a>
            </div>
          )}
        </article>
      </ScrollArea.ScrollArea>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-5 py-3">
        <div className="flex items-start gap-3">
          <Skeleton className="size-5 rounded-sm" />
          <div className="flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        </div>
      </div>
      <div className="flex-1 px-5 pt-5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-5/6" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-2/3" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-3/4" />
      </div>
    </div>
  )
}
