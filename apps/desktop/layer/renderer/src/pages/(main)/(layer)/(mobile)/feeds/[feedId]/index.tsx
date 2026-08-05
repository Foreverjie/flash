import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Navigate, useParams } from "react-router"

import { MobileFeedDetailScreen } from "~/modules/mobile-web/screens/MobileFeedDetailScreen"

export function Component() {
  const isMobile = useMobile()
  const { feedId } = useParams<{ feedId: string }>()

  // Desktop has its own three-column feed view; send the widescreen layout there.
  if (!isMobile) {
    return <Navigate to={`/timeline/view-0/${feedId}`} replace />
  }

  return <MobileFeedDetailScreen />
}
