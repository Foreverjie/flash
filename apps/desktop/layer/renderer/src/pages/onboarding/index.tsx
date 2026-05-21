/**
 * Standalone preview route for the new onboarding flow.
 * Visit /onboarding to view it without resetting your account.
 */
import { useNavigate } from "react-router"

import { OnboardingFlow } from "~/modules/new-user-guide/onboarding-flow"

export function Component() {
  const navigate = useNavigate()
  return (
    <div className="fixed inset-0 z-50 bg-background">
      <OnboardingFlow onClose={() => navigate("/timeline")} />
    </div>
  )
}
