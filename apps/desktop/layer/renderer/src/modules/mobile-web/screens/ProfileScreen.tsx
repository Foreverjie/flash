import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { useWhoami } from "@follow/store/user/hooks"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { replaceImgUrlIfNeed } from "~/lib/img-proxy"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { signOut } from "~/queries/auth"

export function ProfileScreen() {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const user = useWhoami()
  const navigate = useNavigate()
  const { present } = useModalStack()

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-12">
        <EmptyStage
          eyebrow={t("words.login")}
          glyph={<i className="i-mgc-user-3-cute-re" />}
          title={t("mobile.profile.signed_out_title")}
          size="md"
        />
        <button
          type="button"
          className="mt-2 rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-80"
          onClick={() => {
            present({
              CustomModalComponent: PlainModal,
              title: t("words.login"),
              id: "login",
              content: () => <LoginModalContent runtime="browser" />,
              clickOutsideToDismiss: true,
            })
          }}
        >
          {t("words.login")}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <img
          src={replaceImgUrlIfNeed(user.image || undefined)}
          alt=""
          className="size-16 rounded-full object-cover"
        />
        <div className="text-center">
          <div className="text-lg font-semibold text-text">{user.name}</div>
          {user.handle && <div className="text-sm text-text-secondary">@{user.handle}</div>}
        </div>
      </div>

      {/* Menu items */}
      <div className="bg-system-background mx-4 overflow-hidden rounded-2xl">
        <ProfileMenuItem
          icon="i-mgc-settings-7-cute-re"
          label={tCommon("words.settings")}
          onClick={() => navigate("/settings")}
        />
        <ProfileMenuItem
          icon="i-mgc-file-import-cute-re"
          label={t("mobile.profile.import_export")}
          onClick={() => navigate("/discover?type=import")}
        />
        <ProfileMenuItem
          icon="i-mgc-information-cute-re"
          label={t("mobile.profile.about")}
          onClick={() => navigate("/settings/about")}
        />
      </div>

      <div className="bg-system-background mx-4 mt-4 overflow-hidden rounded-2xl">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm text-red transition-colors active:bg-fill-secondary"
          onClick={() => signOut()}
        >
          <i className="i-mgc-exit-cute-re" />
          {t("mobile.profile.sign_out")}
        </button>
      </div>
    </div>
  )
}

function ProfileMenuItem({
  icon,
  label,
  onClick,
}: {
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm text-text transition-colors last:border-b-0 active:bg-fill-secondary"
    >
      <i className={`${icon} text-lg text-text-secondary`} />
      {label}
      <i className="i-mgc-right-cute-re ml-auto text-text-tertiary" />
    </button>
  )
}
