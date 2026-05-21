import { useMobile } from "@follow/components/hooks/useMobile.js"
import { nextFrame } from "@follow/utils/dom"
import { useLayoutEffect } from "react"

import { MobileSettingsCategories } from "~/modules/mobile-web/settings/MobileSettingsCategories"

export const Component = () => {
  const isMobile = useMobile()

  useLayoutEffect(() => {
    if (isMobile) return
    nextFrame(() => window.router.navigate("/settings/general"))
  }, [isMobile])

  if (isMobile) {
    return <MobileSettingsCategories />
  }
  return null
}
