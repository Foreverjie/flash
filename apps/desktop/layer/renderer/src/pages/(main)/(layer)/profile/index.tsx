import { useMobile } from "@follow/components/hooks/useMobile.js"

import { ProfileScreen } from "~/modules/mobile-web/screens/ProfileScreen"
import { MeDesktopScreen } from "~/modules/profile/me/MeDesktopScreen"

export function Component() {
  const isMobile = useMobile()
  if (isMobile) {
    return <ProfileScreen />
  }
  return <MeDesktopScreen />
}
