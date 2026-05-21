import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Outlet } from "react-router"

import { MobileSettingsShell } from "~/modules/mobile-web/settings/MobileSettingsShell"

// On desktop the settings UI is presented through a modal (see useSettingModal),
// so the /settings route renders nothing. On mobile-web we mount a real shell
// so users navigating to /settings (e.g. from the account drawer) get a proper
// full-screen experience instead of a blank page.
export const Component = () => {
  const isMobile = useMobile()
  if (isMobile) {
    return (
      <MobileSettingsShell>
        <Outlet />
      </MobileSettingsShell>
    )
  }
  return null
}
