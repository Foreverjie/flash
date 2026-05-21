import { RootPortal } from "@follow/components/ui/portal/index.jsx"
import { useState } from "react"
import { useNavigate } from "react-router"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { DeclarativeModal } from "~/components/ui/modal/stacked/declarative-modal"
import { ONBOARDING_COACH_FLAG_KEY } from "~/constants/coach"

import { GuideModalContent } from "./guide-modal-content"

export const NewUserGuideModal = () => {
  const [open, setOpen] = useState(true)
  const navigate = useNavigate()
  const handleClose = () => {
    setOpen(false)
    try {
      window.localStorage.setItem(ONBOARDING_COACH_FLAG_KEY, "1")
    } catch {
      // Storage may be unavailable in private mode; coach card just won't show.
    }
    navigate("/timeline")
  }
  return (
    <RootPortal>
      <DeclarativeModal
        id="new-user-guide"
        title="New User Guide"
        CustomModalComponent={PlainModal}
        modalContainerClassName="flex items-center justify-center"
        open={open}
        canClose={false}
        clickOutsideToDismiss={false}
        overlay
      >
        <GuideModalContent onClose={handleClose} />
      </DeclarativeModal>
    </RootPortal>
  )
}
