import type { ReactNode } from "react"

interface BaseFeedCardProps {
  feedId: string
  feedTitle: string
  feedIcon?: string
  entryTitle: string
  publishedAt?: string
  entryId: string
  children: ReactNode
  onClick?: () => void
}

export function BaseFeedCard({
  feedTitle,
  feedIcon,
  entryTitle,
  publishedAt,
  children,
  onClick,
}: BaseFeedCardProps) {
  return (
    <article className="cursor-pointer bg-background px-4 py-3" onClick={onClick}>
      {/* Source row */}
      <div className="mb-1.5 flex items-center gap-2">
        {feedIcon && <img src={feedIcon} alt="" className="size-5 rounded-full object-cover" />}
        <span className="text-[13px] font-semibold text-text-secondary">{feedTitle}</span>
        {publishedAt && (
          <span className="ml-auto text-[13px] text-text-tertiary">{publishedAt}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1.5 line-clamp-2 text-base font-bold text-text">{entryTitle}</h3>

      {/* Type-specific content area */}
      {children}

      {/* Action bar */}
      <div className="mt-2 flex items-center gap-6">
        <button
          type="button"
          aria-label="Bookmark"
          className="rounded-full p-1.5 text-text-tertiary transition-colors active:bg-fill-secondary active:text-text-secondary"
        >
          <i className="i-mgc-star-cute-re text-xl" />
        </button>
        <button
          type="button"
          aria-label="Share"
          className="rounded-full p-1.5 text-text-tertiary transition-colors active:bg-fill-secondary active:text-text-secondary"
        >
          <i className="i-mgc-share-forward-cute-re text-xl" />
        </button>
      </div>
    </article>
  )
}
