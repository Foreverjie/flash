import { useMobile } from "@follow/components/hooks/useMobile.js"
import { useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router"

import { getDefaultTimelinePath } from "~/hooks/biz/getDefaultTimelinePath"
import { MainDestopLayout } from "~/modules/app-layout/subscription-column/index"
import { MobileWebShell } from "~/modules/mobile-web/MobileWebShell"
import { getTimelineViewportTransition } from "~/modules/mobile-web/responsive-timeline-route"

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

  if (isMobile) {
    return <MobileWebShell />
  }
  return <MainDestopLayout />
}
