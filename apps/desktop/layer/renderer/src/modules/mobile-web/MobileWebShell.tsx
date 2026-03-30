import { brandColors } from "@follow/constants"
import { useIsDark } from "@follow/hooks"
import { usePrefetchSessionUser, useWhoami } from "@follow/store/user/hooks"
import { useAtomValue } from "jotai"
import { Outlet, useLocation } from "react-router"

import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { EntriesProvider } from "~/modules/entry-column/context/EntriesContext"
import { CornerPlayer } from "~/modules/player/corner-player"

import { mobileActiveViewAtom } from "./atoms"
import { MobileAccountDrawer } from "./MobileAccountDrawer"
import { MobileHeader } from "./MobileHeader"
import { MobileTabBar } from "./MobileTabBar"

const TAB_ROUTES = new Set(["/", "/discover", "/notifications", "/profile"])
const errorTypes = [
  ErrorComponentType.Page,
  ErrorComponentType.FeedFoundCanBeFollow,
  ErrorComponentType.FeedNotFound,
] as ErrorComponentType[]

export function MobileWebShell() {
  const location = useLocation()
  const isTabRoute = TAB_ROUTES.has(location.pathname)
  const isDark = useIsDark()
  const user = useWhoami()
  const activeView = useAtomValue(mobileActiveViewAtom)
  usePrefetchSessionUser()

  const colorVars = {
    "--fo-brand-accent": isDark ? brandColors.accent.dark : brandColors.accent.light,
    "--fo-brand-accent-pressed": isDark
      ? brandColors.accentPressed.dark
      : brandColors.accentPressed.light,
    "--fo-brand-accent-tint": isDark ? brandColors.accentTint.dark : brandColors.accentTint.light,
    "--fo-brand-accent-muted": isDark
      ? brandColors.accentMuted.dark
      : brandColors.accentMuted.light,
  } as React.CSSProperties

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-background"
      style={colorVars}
    >
      <MobileHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <EntriesProvider viewOverride={activeView}>
          <AppErrorBoundary errorType={errorTypes}>
            <Outlet />
          </AppErrorBoundary>
        </EntriesProvider>
      </main>
      {isTabRoute && <MobileTabBar />}
      <CornerPlayer hideControls />
      {user && <MobileAccountDrawer />}
    </div>
  )
}
