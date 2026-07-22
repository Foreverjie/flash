import { Navigate } from "react-router"

import { useSession } from "~/queries/auth"

// Root entry (`/`). Authenticated users go to their timeline; logged-out
// visitors land on the onboarding/landing flow. From there they can dismiss
// onboarding into the public timeline (`/timeline/*`), which renders without
// bouncing back here.
export function Component() {
  const { status } = useSession()

  if (status === "loading" || status === "unknown") {
    return null
  }

  if (status === "authenticated") {
    return <Navigate to="/timeline" replace />
  }

  return <Navigate to="/onboarding" replace />
}
