import { usePrefetchSessionUser, useWhoami } from "@follow/store/user/hooks"
import { useAtomValue } from "jotai"
import { Outlet, useLocation } from "react-router"

import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { EntriesProvider } from "~/modules/entry-column/context/EntriesContext"
import { CornerPlayer } from "~/modules/player/corner-player"

import { OnboardingCoach } from "../new-user-guide/OnboardingCoach"
import { mobileActiveViewAtom } from "./atoms"
import { useMobileBrandStyle } from "./mobile-brand-style"
import { MobileAccountDrawer } from "./MobileAccountDrawer"
import { MobileHeader } from "./MobileHeader"
import { MobileTabBar } from "./MobileTabBar"
import { MobileEntryReaderHost } from "./reader/MobileEntryReader"
import { TAB_ROUTES } from "./routes"

const errorTypes = [
  ErrorComponentType.Page,
  ErrorComponentType.FeedFoundCanBeFollow,
  ErrorComponentType.FeedNotFound,
] as ErrorComponentType[]

export function MobileWebShell() {
  const location = useLocation()
  const isTabRoute = TAB_ROUTES.has(location.pathname)
  const user = useWhoami()
  const activeView = useAtomValue(mobileActiveViewAtom)
  usePrefetchSessionUser()

  const colorVars = useMobileBrandStyle()

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
      <MobileEntryReaderHost />
      <OnboardingCoach />
    </div>
  )
}
