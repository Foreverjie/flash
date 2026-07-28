export type TimelineViewportTransition = "mobile-root" | "desktop-default" | null

export function getTimelineViewportTransition({
  wasMobile,
  isMobile,
  pathname,
}: {
  wasMobile: boolean
  isMobile: boolean
  pathname: string
}): TimelineViewportTransition {
  const isTimelineRoute = pathname === "/timeline" || pathname.startsWith("/timeline/")
  if (wasMobile === isMobile || !isTimelineRoute) return null
  if (isMobile && pathname !== "/timeline") return "mobile-root"
  if (!isMobile && pathname === "/timeline") return "desktop-default"
  return null
}
