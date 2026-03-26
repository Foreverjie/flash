import { useMobile } from "@follow/components/hooks/useMobile.js"
import { UserArrowLeftIcon } from "@follow/components/icons/user.jsx"
import { ActionButton } from "@follow/components/ui/button/index.js"
import { PresentSheet } from "@follow/components/ui/sheet/Sheet.js"
import type { FC } from "react"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { LoginModalContent } from "~/modules/auth/LoginModalContent"

import { PlainModal } from "../../components/ui/modal/stacked/custom-modal"
import { useModalStack } from "../../components/ui/modal/stacked/hooks"

export interface LoginProps {
  method?: "redirect" | "modal"
}
export const LoginButton: FC<LoginProps> = (props) => {
  const { method } = props
  const modalStack = useModalStack()
  const { t } = useTranslation()
  const isMobile = useMobile()
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleModalLogin = () => {
    if (isMobile) {
      setSheetOpen(true)
    } else {
      modalStack.present({
        CustomModalComponent: PlainModal,
        title: "Login",
        id: "login",
        overlay: true,
        content: () => <LoginModalContent runtime={window.electron ? "app" : "browser"} />,
        clickOutsideToDismiss: true,
      })
    }
  }

  const Content = (
    <ActionButton
      className="relative z-[1]"
      onClick={method === "modal" ? handleModalLogin : undefined}
      tooltip={t("words.login")}
    >
      <UserArrowLeftIcon className="size-4" />
    </ActionButton>
  )

  if (method === "modal") {
    return (
      <>
        {Content}
        {isMobile && (
          <PresentSheet
            open={sheetOpen}
            onOpenChange={setSheetOpen}
            title="Login"
            content={<LoginModalContent runtime="browser" canClose />}
          />
        )}
      </>
    )
  }

  return <a href="/login">{Content}</a>
}
