import { useWhoami } from "@follow/store/user/hooks"
import { useEffect } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router"

/**
 * Routes signed-in users who still need onboarding to the single canonical
 * onboarding mount at `/onboarding` (which lives outside the main layout, so
 * this never loops). The flow's step 1 detects the existing session and skips
 * straight to the topics step.
 *
 * Navigation is imperative and re-keyed on the pathname: a declarative
 * `<Navigate>` here fires only on mount, so a later in-app navigation (e.g.
 * the post-login redirect to /timeline) could land after it and strand a
 * not-yet-onboarded user inside the main app until the next full reload.
 */
export function NewUserGuide() {
  const user = useWhoami()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  // ?onboarding=force lets you preview the flow on an existing account.
  const forceShow = searchParams.get("onboarding") === "force"
  // A user is new until they finish onboarding (server stamps onboardedAt).
  const isNewUser = !!user && !user.onboardedAt

  const shouldOnboard = !!user && (isNewUser || forceShow)

  useEffect(() => {
    if (shouldOnboard) {
      navigate("/onboarding", { replace: true })
    }
  }, [shouldOnboard, location.pathname, navigate])

  return null
}
