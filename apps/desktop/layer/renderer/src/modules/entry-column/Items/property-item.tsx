import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { cn } from "@follow/utils/utils"
import { useTranslation } from "react-i18next"

import { RelativeTime } from "~/components/ui/datetime"

import { ListItem } from "../templates/list-item-template"
import type { UniversalItemProps } from "../types"

/**
 * Property Feed card — renders community (real-estate) listings as cards in the
 * timeline, aligned with the imported Claude "Property Feed" design. Driven by
 * the structured `property` field (carried in entry.extra).
 */
export function PropertyItem({ entryId, translation }: UniversalItemProps) {
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    publishedAt: e.publishedAt,
    feedId: e.feedId,
    property: e.extra?.property,
  }))
  const community = useFeedById(entry?.feedId, (feed) => feed.title)
  const { t } = useTranslation()

  const p = entry?.property
  // No structured data yet (pre-sync) → fall back to the standard list row.
  if (!p) return <ListItem entryId={entryId} translation={translation} />

  const priceChangeAmount = Math.abs(p.price_change_num || 0) / 10000
  const priceChangeDisplay = priceChangeAmount.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })
  const priceChangeSummary = `${p.price_change_num < 0 ? "↓" : "↑"} ${priceChangeDisplay}万 · ${Math.abs(p.price_change_percent).toFixed(1)}%`
  const eventLabel = p.sold
    ? t("property_detail.sold")
    : p.event === "price_up" || p.badge === "increased"
      ? t("property_detail.increased", { amount: priceChangeDisplay })
      : p.event === "price_down" || p.badge === "reduced"
        ? t("property_detail.reduced", {
            amount: p.reduced_by || `${priceChangeDisplay}万`,
          })
        : p.event === "details_changed" || p.badge === "updated"
          ? t("property_detail.details_changed")
          : p.badge === "new"
            ? t("property_detail.new")
            : ""

  const specs = [
    p.area ? `${p.area}㎡` : "",
    [
      p.beds ? `${p.beds}室` : "",
      p.halls ? `${p.halls}厅` : "",
      p.baths ? `${p.baths}卫` : "",
    ].join(""),
    p.orientation ? `${p.orientation}向` : "",
  ].filter(Boolean)

  return (
    <div className={cn("relative py-3", p.sold && "opacity-80")}>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-text-secondary">
            {community ?? p.community}
          </span>
          {!!eventLabel && (
            <span
              className={cn(
                "shrink-0 text-[10px] font-semibold",
                p.event === "price_down" || p.badge === "reduced"
                  ? "text-red"
                  : p.event === "price_up" || p.badge === "increased"
                    ? "text-green"
                    : "text-accent",
              )}
            >
              {eventLabel}
            </span>
          )}
        </div>
        {!!entry?.publishedAt && (
          <span className="flex shrink-0 items-center gap-1 text-[10px] text-text-tertiary">
            <span>{t("property_detail.observed_at")}</span>
            <RelativeTime date={entry.publishedAt} />
          </span>
        )}
      </div>

      <div className="line-clamp-1 text-[13px] font-medium leading-5 text-text">
        {p.title || entry?.title}
      </div>

      <div className="mt-1.5 flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-lg font-bold leading-none text-text">{p.total}</span>
        {!!p.orig && (p.event === "price_down" || p.event === "price_up") && (
          <span className="shrink-0 text-[10px] text-text-tertiary line-through">{p.orig}</span>
        )}
        {!!p.unit && (
          <span className="min-w-0 truncate text-[10px] text-text-tertiary">{p.unit}</span>
        )}
        {specs.length > 0 && (
          <span className="ml-auto shrink-0 text-[11px] text-text-secondary">
            {specs.join(" · ")}
          </span>
        )}
      </div>

      {!!p.price_change_num && (
        <div
          className={cn(
            "mt-1 text-[10px] font-medium",
            p.price_change_num < 0 ? "text-red" : "text-green",
          )}
        >
          <span>{priceChangeSummary}</span>
        </div>
      )}

      {(p.hood || p.city) && (
        <div className="mt-1 truncate text-[10px] text-text-tertiary">
          {[p.hood, p.city].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  )
}

PropertyItem.wrapperClassName = cn("border-b border-border px-3")
