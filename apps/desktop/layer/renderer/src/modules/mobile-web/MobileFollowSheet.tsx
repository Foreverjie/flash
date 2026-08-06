import { FeedViewType, getViewList } from "@follow/constants"
import type { FeedModel } from "@follow/store/feed/types"
import { useCategories } from "@follow/store/subscription/hooks"
import { subscriptionSyncService } from "@follow/store/subscription/store"
import { cn } from "@follow/utils/utils"
import { useMutation } from "@tanstack/react-query"
import { cloneElement, useId, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { toastFetchError } from "~/lib/error-parser"
import { FeedIcon } from "~/modules/feed/feed-icon"
import { feed as feedQuery } from "~/queries/feed"

import { MobileSheet } from "./MobileSheet"

/**
 * Follow confirmation as a bottom sheet. The desktop `FeedForm` modal is a
 * desktop-sized centered dialog; on mobile web we only ask for the two things
 * that matter — which view the feed lands in, and an optional category.
 */
export function MobileFollowSheet({
  feed,
  feedId,
  onClose,
}: {
  feed: FeedModel | undefined
  feedId: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const categoryListId = useId()

  const [view, setView] = useState<FeedViewType>(FeedViewType.Articles)
  const [category, setCategory] = useState("")

  const views = useMemo(() => getViewList().filter((v) => v.switchable), [])
  const categories = useCategories()
  const suggestions = useMemo(
    () => [...(categories ?? [])].sort((a, b) => a.localeCompare(b)),
    [categories],
  )

  const { mutate: follow, isPending } = useMutation({
    mutationFn: async () => {
      await subscriptionSyncService.subscribe({
        url: feed?.url,
        view,
        category: category.trim() || null,
        isPrivate: false,
        hideFromTimeline: null,
        title: null,
        feedId,
        listId: undefined,
      })
    },
    onSuccess: () => {
      feedQuery.byId({ id: feedId }).invalidate()
      toast.success(t("feed_form.followed"), { duration: 1000 })
      onClose()
    },
    onError: (error) => {
      toastFetchError(error)
    },
  })

  return (
    <MobileSheet label={t("mobile.feed.follow_sheet.title")} onClose={onClose}>
      <div className="flex items-center gap-2.5">
        <FeedIcon
          target={{
            title: feed?.title,
            image: feed?.image,
            siteUrl: feed?.siteUrl,
            type: "feed",
          }}
          size={34}
          noMargin
        />
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-text">{feed?.title}</div>
          <div className="text-xs text-text-tertiary">{t("mobile.feed.follow_sheet.subtitle")}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
          {t("mobile.feed.follow_sheet.view")}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {views.map((item) => {
            const selected = item.view === view
            return (
              <button
                key={item.name}
                type="button"
                aria-pressed={selected}
                onClick={() => setView(item.view)}
                className={cn(
                  "flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border text-xs transition-colors",
                  selected
                    ? "border-accent-ink/40 bg-fill-quinary text-text"
                    : "border-border text-text-secondary",
                )}
              >
                {cloneElement(item.icon, {
                  className: cn("text-xl", selected ? item.className : "text-text-tertiary"),
                })}
                <span className="max-w-full truncate px-1">{tCommon(item.name)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        <label
          htmlFor={`${categoryListId}-input`}
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary"
        >
          {t("feed_form.category")}
        </label>
        <input
          id={`${categoryListId}-input`}
          list={categoryListId}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t("mobile.feed.follow_sheet.category_placeholder")}
          className="focus:border-accent-ink/40 mt-2 h-11 w-full rounded-xl border border-border bg-fill-quinary px-3.5 text-[15px] text-text outline-none placeholder:text-text-tertiary"
        />
        <datalist id={categoryListId}>
          {suggestions.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>

      <div className="mt-5 flex gap-2 pb-4">
        <button
          type="button"
          onClick={onClose}
          className="h-11 shrink-0 rounded-xl border border-border px-5 text-[15px] font-semibold text-text transition-opacity active:opacity-80"
        >
          {tCommon("words.cancel")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => follow()}
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-accent text-[15px] font-semibold text-[var(--fo-accent-fg)] transition-opacity active:opacity-80 disabled:opacity-50"
        >
          {isPending && <i className="i-mgc-loading-3-cute-re animate-spin" />}
          <span>{tCommon("words.follow")}</span>
        </button>
      </div>
    </MobileSheet>
  )
}
