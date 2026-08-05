import { isMobile } from "@follow/components/hooks/useMobile.js"
import { lazy, Suspense } from "react"
import { redirect } from "react-router"

import { getDefaultTimelinePath } from "~/hooks/biz/getDefaultTimelinePath"

const HomeFeedScreen = lazy(() =>
  import("~/modules/mobile-web/screens/HomeFeedScreen").then((module) => ({
    default: module.HomeFeedScreen,
  })),
)

export function Component() {
  return (
    <Suspense fallback={<HomeFeedFallback />}>
      <HomeFeedScreen />
    </Suspense>
  )
}

const HomeFeedFallback = () => (
  <div className="flex flex-col">
    <div className="mx-4 my-2 h-8 animate-pulse rounded-full bg-fill-tertiary" />
    {Array.from({ length: 6 }).map((_, index) => (
      <div
        // eslint-disable-next-line @eslint-react/no-array-index-key
        key={index}
        className="border-b border-border/50 bg-background px-4 py-3"
      >
        <div className="mb-2 h-3 w-24 animate-pulse rounded bg-fill-tertiary" />
        <div className="mb-2 h-4 w-4/5 animate-pulse rounded bg-fill-tertiary" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-fill-tertiary" />
      </div>
    ))}
  </div>
)

// eslint-disable-next-line react-refresh/only-export-components
export const loader = () => {
  if (isMobile()) {
    return null
  }

  return redirect(getDefaultTimelinePath())
}
