import { brandColors } from "@follow/constants"
import { useIsDark } from "@follow/hooks"
import { usePrefetchSessionUser, useWhoami } from "@follow/store/user/hooks"
import { Outlet, useLocation } from "react-router"

import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { EntriesProvider } from "~/modules/entry-column/context/EntriesContext"

import { MobileHeader } from "./MobileHeader"
import { MobileSubscriptionDrawer } from "./MobileSubscriptionDrawer"
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
      className="bg-secondary-system-background relative flex h-screen flex-col overflow-hidden"
      style={colorVars}
    >
      <MobileHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <EntriesProvider>
          <AppErrorBoundary errorType={errorTypes}>
            <Outlet />
          </AppErrorBoundary>
        </EntriesProvider>
      </main>
      {isTabRoute && <MobileTabBar />}
      {user && <MobileSubscriptionDrawer />}
    </div>
  )
}
