import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { cn } from "@follow/utils/utils"
import { AnimatePresence, m } from "motion/react"
import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { usePostDetailQuery } from "~/queries/posts"

type DetailVariant = "panel" | "modal"

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
  const { t } = useTranslation()

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
          <PostDetailContent postId={postId} onClose={onClose} variant="panel" />
        </m.div>
      ) : (
        <m.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-full min-w-0 flex-1 items-center justify-center px-6"
        >
          <div className="max-w-xs text-center text-text-tertiary">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-fill-quaternary text-text-quaternary">
              <i className="i-mgc-document-cute-re text-3xl" />
            </div>
            <p className="mt-4 text-sm">
              {t("post_detail.select_to_read", { defaultValue: "Select a post to read" })}
            </p>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Inner content for detail panel, also used by mobile sheet.
 */
export function PostDetailContent({
  postId,
  onClose,
  variant = "modal",
}: {
  postId: string
  onClose: () => void
  variant?: DetailVariant
}) {
  const { data: post, isLoading, isError } = usePostDetailQuery(postId)
  const { t } = useTranslation()

  const handleOpenExternal = useCallback(() => {
    if (post?.url) {
      window.open(post.url, "_blank", "noopener,noreferrer")
    }
  }, [post?.url])

  const handleCopyLink = useCallback(() => {
    if (!post?.url || typeof navigator === "undefined" || !navigator.clipboard) {
      return
    }

    navigator.clipboard
      .writeText(post.url)
      .then(() => {
        toast.success(t("post_detail.link_copied", { defaultValue: "Link copied" }))
      })
      .catch(() => {
        toast.error(t("post_detail.link_copy_failed", { defaultValue: "Unable to copy link" }))
      })
  }, [post?.url, t])

  const htmlContent = useMemo(() => {
    if (!post) return null
    const html = post.formattedContent?.html
    if (html) return html
    if (post.content) return post.content
    if (post.description) return post.description
    return null
  }, [post])

  const images = useMemo(() => post?.media?.filter((m) => m.type === "image") ?? [], [post?.media])
  const isModal = variant === "modal"

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden",
        isModal ? "bg-theme-background" : "border-l border-border/80 bg-fill-quinary/40",
      )}
    >
      {isModal && (
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(255,92,0,0.1), transparent 26%), radial-gradient(circle at top right, rgba(14,165,233,0.08), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent 18%)",
          }}
        />
      )}
      <div
        className={cn(
          "sticky top-0 z-10 border-b px-5 py-3",
          isModal
            ? "border-border bg-theme-background backdrop-blur-xl"
            : "border-border/80 bg-fill-quinary/85 backdrop-blur-xl",
        )}
      >
        <div className="flex items-start gap-3">
          {post?.feedImage ? (
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
            {isLoading ? (
              <div className="space-y-2 py-0.5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            ) : (
              <>
                {post?.title ? (
                  <h1 className="text-lg font-bold leading-snug text-text">{post.title}</h1>
                ) : (
                  <h1 className="text-lg font-bold leading-snug text-text-secondary">
                    {t("post_detail.untitled", { defaultValue: "Untitled post" })}
                  </h1>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-text-secondary">
                  <span className="font-medium">
                    {post?.feedTitle ||
                      t("post_detail.unknown_feed", { defaultValue: "Unknown Feed" })}
                  </span>
                  {post?.author && (
                    <>
                      <span className="text-text-quaternary">·</span>
                      <span>{post.author}</span>
                    </>
                  )}
                  {post?.publishedAt && (
                    <>
                      <span className="text-text-quaternary">·</span>
                      <span>{formatDate(post.publishedAt)}</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {post?.url && !isLoading && (
              <>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-fill-secondary hover:text-text"
                  onClick={handleCopyLink}
                  title={t("post_detail.copy_link", { defaultValue: "Copy link" })}
                >
                  <i className="i-mgc-link-2-cute-re text-base" />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-fill-secondary hover:text-text"
                  onClick={handleOpenExternal}
                  title={t("post_detail.open_original", { defaultValue: "Open original" })}
                >
                  <i className="i-mgc-external-link-cute-re text-base" />
                </button>
              </>
            )}
            <button
              type="button"
              className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-fill-secondary hover:text-text"
              onClick={onClose}
              title={t("words.close", { defaultValue: "Close" })}
            >
              <i className="i-mgc-close-cute-re text-base" />
            </button>
          </div>
        </div>
      </div>

      <ScrollArea.ScrollArea
        rootClassName="relative min-h-0 flex-1"
        viewportClassName={cn("h-full px-5", isModal ? "pb-safe-offset-4" : "pb-6")}
      >
        <article className="mx-auto max-w-[72ch] pb-12 pt-5">
          {isLoading ? (
            <DetailSkeleton />
          ) : isError || !post ? (
            <DetailStatus
              icon="i-mgc-alert-cute-re"
              message={t("post_detail.not_found", { defaultValue: "Post not found" })}
            />
          ) : (
            <>
              {images.length > 0 && (
                <div
                  className={cn(
                    "mb-5 grid gap-2.5",
                    images.length === 1 ? "grid-cols-1" : "grid-cols-2",
                  )}
                >
                  {images.map((img) => (
                    <img
                      key={img.url}
                      src={img.url}
                      alt=""
                      className="max-h-[360px] w-full rounded-xl border border-border/70 bg-fill-quaternary object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}

              {htmlContent ? (
                <div
                  className="prose prose-neutral max-w-none break-words text-[15px] leading-7 text-text dark:prose-invert prose-headings:text-text prose-p:text-text prose-a:text-blue prose-strong:text-text prose-img:rounded-xl"
                  dangerouslySetInnerHTML={{ __html: htmlContent }}
                />
              ) : (
                <DetailStatus
                  icon="i-mgc-file-forbidden-cute-re"
                  message={t("post_detail.no_content", { defaultValue: "No content available" })}
                />
              )}

              {post.categories && post.categories.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-1.5">
                  {post.categories.map((cat) => (
                    <span
                      key={cat}
                      className="rounded-full border border-border/70 bg-fill-quaternary px-2.5 py-1 text-xs text-text-secondary"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}

              {post.url && (
                <div className="mt-8 border-t border-border pt-4">
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-blue transition-opacity hover:opacity-80"
                  >
                    <i className="i-mgc-external-link-cute-re" />
                    {t("post_detail.read_original", { defaultValue: "Read original article" })}
                  </a>
                </div>
              )}
            </>
          )}
        </article>
      </ScrollArea.ScrollArea>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    </div>
  )
}

function DetailStatus({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center text-text-tertiary">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-fill-quaternary">
        <i className={cn(icon, "text-3xl text-text-quaternary")} />
      </div>
      <p className="text-sm">{message}</p>
    </div>
  )
}
