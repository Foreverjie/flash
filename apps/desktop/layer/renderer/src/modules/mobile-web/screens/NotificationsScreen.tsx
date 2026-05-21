import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { useWhoami } from "@follow/store/user/hooks"
import { useTranslation } from "react-i18next"

export function NotificationsScreen() {
  const { t } = useTranslation()
  const user = useWhoami()

  if (!user) {
    return (
      <div className="px-6 py-12">
        <EmptyStage
          eyebrow={t("mobile.notifications.title")}
          glyph={<i className="i-mgc-notification-cute-re" />}
          title={t("mobile.notifications.signed_out_title")}
          size="md"
        />
      </div>
    )
  }

  return (
    <div className="px-6 py-12">
      <EmptyStage
        eyebrow={t("mobile.notifications.title")}
        glyph={<i className="i-mgc-notification-cute-re" />}
        title={t("mobile.notifications.empty.title")}
        body={t("mobile.notifications.empty.body")}
        size="md"
      />
    </div>
  )
}
