import { isMobile } from "@follow/components/hooks/useMobile.js"
import { redirect } from "react-router"

import { getDefaultTimelinePath } from "~/hooks/biz/getDefaultTimelinePath"
import { HomeFeedScreen } from "~/modules/mobile-web/screens/HomeFeedScreen"

export function Component() {
  return <HomeFeedScreen />
}

// eslint-disable-next-line react-refresh/only-export-components
export const loader = () => {
  if (isMobile()) {
    return null
  }

  return redirect(getDefaultTimelinePath())
}
