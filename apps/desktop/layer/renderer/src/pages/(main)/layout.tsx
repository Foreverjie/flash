import { useMobile } from "@follow/components/hooks/useMobile.js"
import { lazy, Suspense, useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router"

import { getDefaultTimelinePath } from "~/hooks/biz/getDefaultTimelinePath"
import { getTimelineViewportTransition } from "~/modules/mobile-web/responsive-timeline-route"

const MainDesktopLayout = lazy(() =>
  import("~/modules/app-layout/subscription-column/index").then((module) => ({
    default: module.MainDestopLayout,
  })),
)
const MobileWebShell = lazy(() =>
  import("~/modules/mobile-web/MobileWebShell").then((module) => ({
    default: module.MobileWebShell,
  })),
)

export function Component() {
  const isMobile = useMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const previousIsMobile = useRef(isMobile)

  useEffect(() => {
    const wasMobile = previousIsMobile.current
    previousIsMobile.current = isMobile
    const transition = getTimelineViewportTransition({
      wasMobile,
      isMobile,
      pathname: location.pathname,
    })

    if (transition === "mobile-root") {
      navigate("/timeline", { replace: true })
      return
    }

    if (transition === "desktop-default") {
      navigate(getDefaultTimelinePath(), { replace: true })
    }
  }, [isMobile, location.pathname, navigate])

  return (
    <Suspense fallback={<div className="size-full bg-background" />}>
      {isMobile ? <MobileWebShell /> : <MainDesktopLayout />}
    </Suspense>
  )
}
