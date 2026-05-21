import { cn } from "@follow/utils/utils"
import { Slot } from "@radix-ui/react-slot"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { useAvailableSettings } from "~/modules/settings/hooks/use-setting-ctx"

export function MobileSettingsCategories() {
  const { t } = useTranslation("settings")
  const items = useAvailableSettings()

  return (
    <div className="flex flex-col gap-3 px-3 py-4">
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        {items.map((item, idx) => (
          <Link
            key={item.path}
            to={`/settings/${item.path}`}
            className={cn(
              "flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fill-secondary",
              idx > 0 && "border-t border-border/60",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-fill-tertiary text-accent">
              {typeof item.icon === "string" ? (
                <i className={cn(item.icon, "size-4")} />
              ) : (
                <Slot className="size-4">{item.icon}</Slot>
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] text-text">
              {t(item.name as never)}
            </span>
            <i className="i-mgc-right-cute-re size-4 shrink-0 text-text-tertiary" />
          </Link>
        ))}
      </div>
    </div>
  )
}
