import { cn } from "@follow/utils/utils"
import { useTranslation } from "react-i18next"

import { useSubscriptionUsageQuery } from "~/queries/subscription-usage"

/**
 * Sidebar footer meter: feeds subscribed against the account cap.
 * Renders nothing until the usage query resolves, so the sidebar never shows a
 * placeholder bar that then jumps to a real value.
 */
export const QuotaFooter = () => {
  const { t } = useTranslation()
  const { data } = useSubscriptionUsageQuery()

  if (!data) return null

  const { used, limit } = data
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0
  const isFull = used >= limit
  const isNearlyFull = !isFull && ratio >= 0.9

  return (
    <div
      className="flex shrink-0 items-center gap-2 border-t border-border-secondary px-3.5 py-2 text-[11px] text-text-tertiary"
      title={t("sidebar.quota.tooltip", { used, limit })}
    >
      {/* "13 / 100" alone reads as a mystery, so the row is labelled. */}
      <span className="shrink-0">{t("sidebar.quota.label")}</span>
      <div className="h-1 min-w-6 flex-1 overflow-hidden rounded-full bg-fill">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            isFull ? "bg-red" : isNearlyFull ? "bg-orange" : "bg-accent",
          )}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 2 : 0)}%` }}
        />
      </div>
      <span className={cn("shrink-0 tabular-nums", isFull && "font-semibold text-red")}>
        {used} / {limit}
      </span>
    </div>
  )
}
