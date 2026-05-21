import { ActionButton } from "@follow/components/ui/button/index.js"
import { UserRole, UserRoleName } from "@follow/constants"
import { useUserRole } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { memo } from "react"
import { useTranslation } from "react-i18next"

import { useIsInMASReview, useServerConfigs } from "~/atoms/server-configs"
import { setTimelineColumnShow, useSubscriptionColumnShow } from "~/atoms/sidebar"
import { useI18n } from "~/hooks/common"
import { useSettingModal } from "~/modules/settings/modal/use-setting-modal-hack"
import { ProfileButton } from "~/modules/user/ProfileButton"

export const SubscriptionColumnDock = memo(() => {
  const t = useI18n()
  const { t: tCommon } = useTranslation()
  const settingModalPresent = useSettingModal()
  const role = useUserRole()
  const serverConfig = useServerConfigs()
  const isInMASReview = useIsInMASReview()
  const feedColumnShow = useSubscriptionColumnShow()

  const showPlan = !isInMASReview && serverConfig?.PAYMENT_ENABLED && !!role
  const isPaid = role && role !== UserRole.Trial && role !== UserRole.Free

  return (
    <div
      data-hide-in-print
      className={cn(
        "flex h-11 shrink-0 items-center justify-between gap-1 border-t border-border px-3",
        "bg-material-thick",
      )}
    >
      <div className="flex items-center">
        <ProfileButton method="modal" animatedAvatar />
      </div>

      <div className="flex items-center gap-0.5">
        {showPlan && (
          <button
            type="button"
            onClick={() => settingModalPresent("plan")}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2",
              "text-[11px] font-medium transition-colors duration-150",
              "hover:bg-theme-item-hover",
              isPaid ? "text-accent" : "text-text-secondary",
            )}
            aria-label={tCommon("activation.plan.title")}
          >
            <i className="i-mgc-power size-3" />
            <span>{UserRoleName[role]}</span>
          </button>
        )}

        <ActionButton
          tooltip={tCommon("user_button.preferences")}
          shortcut="$mod+,"
          onClick={() => settingModalPresent()}
        >
          <i className="i-mgc-settings-7-cute-re size-4 text-text-secondary" />
        </ActionButton>

        <ActionButton
          tooltip={t("app.toggle_sidebar")}
          onClick={() => setTimelineColumnShow(!feedColumnShow)}
        >
          <i
            className={cn(
              feedColumnShow
                ? "i-mgc-layout-leftbar-close-cute-re"
                : "i-mgc-layout-leftbar-open-cute-re",
              "size-4 text-text-secondary",
            )}
          />
        </ActionButton>
      </div>
    </div>
  )
})
SubscriptionColumnDock.displayName = "SubscriptionColumnDock"
