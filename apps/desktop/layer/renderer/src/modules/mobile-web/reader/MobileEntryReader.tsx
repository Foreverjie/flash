import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { useSubscriptionByFeedId } from "@follow/store/subscription/hooks"
import { unreadSyncService } from "@follow/store/unread/store"
import { cn } from "@follow/utils/utils"
import { useAtom } from "jotai"
import { AnimatePresence, m } from "motion/react"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { RelativeTime } from "~/components/ui/datetime"
import { useEntryContent } from "~/modules/entry-content/hooks"
import { FeedIcon } from "~/modules/feed/feed-icon"
import { EntryContentHTMLRenderer } from "~/modules/renderer/html"

import { mobileReaderEntryIdAtom } from "../atoms"

export function MobileEntryReaderHost() {
  const [entryId, setEntryId] = useAtom(mobileReaderEntryIdAtom)
  return (
    <AnimatePresence>
      {entryId && (
        <m.div
          key={entryId}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 320 }}
          className="fixed inset-0 z-[55] flex flex-col bg-background"
        >
          <MobileEntryReader entryId={entryId} onClose={() => setEntryId(null)} />
        </m.div>
      )}
    </AnimatePresence>
  )
}

function MobileEntryReader({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    url: e.url,
    feedId: e.feedId,
    publishedAt: e.publishedAt,
    author: e.author,
  }))
  const feed = useFeedById(entry?.feedId)
  const subscription = useSubscriptionByFeedId(entry?.feedId)
  const { content, isPending, error } = useEntryContent(entryId)

  useEffect(() => {
    if (!entry?.feedId) return
    unreadSyncService.markEntryAsRead(entryId)
  }, [entry?.feedId, entryId])

  // Close on Escape so external keyboards still work.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <>
      <header
        className={cn(
          "flex shrink-0 items-center gap-2 border-b border-border px-2",
          "h-12 pt-safe-area-top",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon("words.back")}
          className="inline-flex size-9 items-center justify-center rounded-md border-0 bg-transparent text-text-secondary"
        >
          <i className="i-mgc-arrow-left-cute-re size-5" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {feed && (
            <FeedIcon
              target={{
                title: feed.title,
                image: feed.image,
                siteUrl: feed.siteUrl,
                type: "feed",
              }}
              size={18}
              noMargin
            />
          )}
          <span className="min-w-0 truncate text-[13px] font-medium text-text-secondary">
            {feed?.title ?? t("mobile.home.unknown_source")}
          </span>
        </div>
        {entry?.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("entry_actions.open_in_browser", { which: "" })}
            className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary"
          >
            <i className="i-mgc-external-link-cute-re size-4" />
          </a>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto pb-safe-area-bottom">
        <article className="mx-auto max-w-2xl px-5 py-6">
          {entry?.title && (
            <h1 className="mb-3 text-balance text-[22px] font-bold leading-tight text-text">
              {entry.title}
            </h1>
          )}
          <div className="mb-5 flex items-center gap-2 text-[12px] text-text-tertiary">
            {entry?.author && <span className="truncate">{entry.author}</span>}
            {entry?.author && entry?.publishedAt && <span aria-hidden>·</span>}
            {entry?.publishedAt && <RelativeTime date={entry.publishedAt} />}
          </div>

          {error ? (
            <div className="rounded-lg border border-border bg-fill-tertiary px-4 py-3 text-sm text-text-secondary">
              {String((error as Error)?.message ?? error)}
            </div>
          ) : isPending && !content ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  key={i}
                  className="h-3 animate-pulse rounded bg-fill-tertiary"
                  style={{ width: `${70 + ((i * 13) % 30)}%` }}
                />
              ))}
            </div>
          ) : content ? (
            <EntryContentHTMLRenderer
              view={subscription?.view ?? 0}
              feedId={entry?.feedId ?? ""}
              entryId={entryId}
              as="div"
              className="prose prose-sm max-w-none dark:prose-invert"
            >
              {content}
            </EntryContentHTMLRenderer>
          ) : null}
        </article>
      </main>
    </>
  )
}
