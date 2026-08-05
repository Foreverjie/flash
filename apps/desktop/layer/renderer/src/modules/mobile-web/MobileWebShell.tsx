import { usePrefetchSessionUser, useWhoami } from "@follow/store/user/hooks"
import { useAtomValue } from "jotai"
import { lazy, Suspense } from "react"
import { Outlet, useLocation } from "react-router"

import { useAudioPlayerAtomSelector } from "~/atoms/player"
import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { EntriesProvider } from "~/modules/entry-column/context/EntriesContext"

import { OnboardingCoach } from "../new-user-guide/OnboardingCoach"
import { mobileActiveViewAtom, mobileDrawerOpenAtom, mobileReaderEntryIdAtom } from "./atoms"
import { useMobileBrandStyle } from "./mobile-brand-style"
import { MobileHeader } from "./MobileHeader"
import { MobileTabBar } from "./MobileTabBar"
import { TAB_ROUTES } from "./routes"

const MobileAccountDrawer = lazy(() =>
  import("./MobileAccountDrawer").then((module) => ({ default: module.MobileAccountDrawer })),
)
const MobileEntryReaderHost = lazy(() =>
  import("./reader/MobileEntryReader").then((module) => ({
    default: module.MobileEntryReaderHost,
  })),
)
const CornerPlayer = lazy(() =>
  import("~/modules/player/corner-player").then((module) => ({ default: module.CornerPlayer })),
)

const errorTypes = [
  ErrorComponentType.Page,
  ErrorComponentType.FeedFoundCanBeFollow,
  ErrorComponentType.FeedNotFound,
] as ErrorComponentType[]

export function MobileWebShell() {
  const location = useLocation()
  const isTabRoute = TAB_ROUTES.has(location.pathname)
  // Routes that render their own top chrome, so the shell header stands down.
  const ownsHeader =
    location.pathname.startsWith("/timeline/") || location.pathname.startsWith("/feeds/")
  const user = useWhoami()
  const activeView = useAtomValue(mobileActiveViewAtom)
  const drawerOpen = useAtomValue(mobileDrawerOpenAtom)
  const readerEntryId = useAtomValue(mobileReaderEntryIdAtom)
  const playerVisible = useAudioPlayerAtomSelector((state) => state.show)
  usePrefetchSessionUser()

  const colorVars = useMobileBrandStyle()

  return (
    <div
      className="relative flex h-dvh h-screen flex-col overflow-hidden bg-background"
      style={colorVars}
    >
      {!ownsHeader && <MobileHeader />}
      <main className="min-h-0 flex-1 overflow-y-auto">
        {user ? (
          <EntriesProvider viewOverride={activeView}>
            <AppErrorBoundary errorType={errorTypes}>
              <Outlet />
            </AppErrorBoundary>
          </EntriesProvider>
        ) : (
          <AppErrorBoundary errorType={errorTypes}>
            <Outlet />
          </AppErrorBoundary>
        )}
      </main>
      {isTabRoute && <MobileTabBar />}
      {playerVisible && (
        <Suspense fallback={null}>
          <CornerPlayer hideControls />
        </Suspense>
      )}
      {user && drawerOpen && (
        <Suspense fallback={null}>
          <MobileAccountDrawer />
        </Suspense>
      )}
      {user && readerEntryId && (
        <Suspense fallback={<MobileReaderFallback />}>
          <MobileEntryReaderHost />
        </Suspense>
      )}
      <OnboardingCoach />
    </div>
  )
}

const MobileReaderFallback = () => (
  <div className="fixed inset-0 z-[55] flex items-center justify-center bg-background">
    <i className="i-mgc-loading-3-cute-re animate-spin text-2xl text-text-tertiary" />
  </div>
)
