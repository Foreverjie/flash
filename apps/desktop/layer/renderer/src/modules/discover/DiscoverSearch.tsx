import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { cn } from "@follow/utils/utils"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { useIsInMASReview } from "~/atoms/server-configs"
import { followClient } from "~/lib/api-client"

import { DiscoverFeedCard } from "./DiscoverFeedCard"

export type DiscoverSearchTarget = "feeds" | "lists"

const RESULT_SKELETON_KEYS = Array.from({ length: 3 }, (_, index) => `result-${index}`)

/**
 * The Discover search box. `big` renders the hero variant (60px tall with an
 * inline Search button); the compact variant is used in narrow layouts.
 */
export function DiscoverSearchField({
  value,
  big,
  autoFocus,
  onSubmit,
}: {
  value: string
  big?: boolean
  autoFocus?: boolean
  onSubmit: (keyword: string) => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep in sync when the query changes from outside (back/forward, chips).
  useEffect(() => setDraft(value), [value])

  const submit = () => {
    const keyword = draft.trim()
    onSubmit(keyword)
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className={cn(
        "group flex w-full items-center gap-3 border border-border bg-background transition-colors",
        "focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/25",
        big ? "h-[60px] rounded-2xl pl-5 pr-2 shadow-[var(--shadow-card)]" : "h-11 rounded-xl px-3",
      )}
    >
      <i
        className={cn(
          "i-mgc-search-2-cute-re shrink-0 text-text-tertiary",
          big ? "size-5" : "size-4",
        )}
      />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        aria-label={t("discover.search_placeholder")}
        autoFocus={autoFocus}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("discover.search_placeholder")}
        data-testid="discover-search-input"
        className={cn(
          "min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-text-secondary [&::-webkit-search-cancel-button]:appearance-none",
          big ? "text-base" : "text-sm",
        )}
      />
      {(draft || value) && (
        <button
          type="button"
          aria-label={t("discover.search_clear")}
          onClick={() => {
            setDraft("")
            onSubmit("")
            inputRef.current?.focus()
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-fill-secondary focus-visible:ring-2 focus-visible:ring-accent"
        >
          <i aria-hidden className="i-mgc-close-cute-re size-4" />
        </button>
      )}
      <button
        type="submit"
        aria-label={t("words.search")}
        disabled={!draft.trim()}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-accent font-bold text-accent-fg transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent-ink focus-visible:ring-offset-2 disabled:opacity-50",
          big ? "h-11 px-5 text-sm" : "size-9",
        )}
      >
        {big ? t("words.search") : <i aria-hidden className="i-mgc-right-cute-re size-5" />}
      </button>
    </form>
  )
}

/** Feeds / Lists switch above the result list. */
export function DiscoverResultTabs({
  target,
  onChange,
}: {
  target: DiscoverSearchTarget
  onChange: (target: DiscoverSearchTarget) => void
}) {
  const { t } = useTranslation()
  const items: { value: DiscoverSearchTarget; label: string }[] = [
    { value: "feeds", label: t("discover.target.feeds") },
    { value: "lists", label: t("discover.target.lists") },
  ]

  return (
    <div className="mb-5 flex gap-1 border-b border-border">
      {items.map((item) => {
        const active = item.value === target
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent",
              active
                ? "border-accent font-bold text-text"
                : "border-transparent font-semibold text-text-tertiary hover:text-text-secondary",
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function DiscoverSearchResults({
  keyword,
  target,
}: {
  keyword: string
  target: DiscoverSearchTarget
}) {
  const { t } = useTranslation()
  const isInMASReview = useIsInMASReview()

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["discover", "search", keyword, target],
    enabled: !!keyword,
    queryFn: async () => {
      const { data } = await followClient.api.discover.discover({
        keyword: keyword.trim(),
        target,
      })
      return isInMASReview ? data.filter((item) => !item.list?.fee) : data
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {RESULT_SKELETON_KEYS.map((key) => (
          <Skeleton key={key} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="py-8">
        <p className="text-sm text-text-secondary">{t("discover.search_error")}</p>
        <button
          type="button"
          disabled={isFetching}
          onClick={() => void refetch()}
          className="mt-4 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg focus-visible:ring-2 focus-visible:ring-accent-ink disabled:opacity-50"
        >
          {t("retry", { ns: "common" })}
        </button>
      </div>
    )
  }

  return (
    <div data-testid="discover-search-results">
      <div role="status" className="mb-4 text-sm text-text-secondary">
        {t("discover.search.results", { count: data?.length || 0 })}
      </div>
      {data?.length === 0 && (
        <p className="mb-6 text-sm text-text-secondary">{t("discover.search_empty_hint")}</p>
      )}
      <div className="space-y-4 text-sm">
        {data?.map((item) => (
          <DiscoverFeedCard key={item.feed?.id || item.list?.id} item={item} />
        ))}
      </div>
    </div>
  )
}
