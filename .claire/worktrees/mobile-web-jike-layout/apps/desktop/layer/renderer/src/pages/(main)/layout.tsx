import { useMobile } from "@follow/components/hooks/useMobile.js"

import { MainDestopLayout } from "~/modules/app-layout/subscription-column/index"
import { MobileWebShell } from "~/modules/mobile-web/MobileWebShell"

export function Component() {
  const isMobile = useMobile()
  if (isMobile) {
    return <MobileWebShell />
  }
  return <MainDestopLayout />
}
