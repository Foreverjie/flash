import { useWhoami } from "@follow/store/user/hooks"
import { Navigate, useSearchParams } from "react-router"

/**
 * Routes signed-in users who still need onboarding to the single canonical
 * onboarding mount at `/onboarding` (which lives outside the main layout, so
 * this never loops). The flow's step 1 detects the existing session and skips
 * straight to the topics step.
 */
export function NewUserGuide() {
  const user = useWhoami()
  const [searchParams] = useSearchParams()
  // ?onboarding=force lets you preview the flow on an existing account.
  const forceShow = searchParams.get("onboarding") === "force"
  // A user is new until they finish onboarding (server stamps onboardedAt).
  const isNewUser = !!user && !user.onboardedAt

  return user && (isNewUser || forceShow) ? <Navigate to="/onboarding" replace /> : null
}
