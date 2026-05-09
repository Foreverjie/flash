import { useEffect } from "react"

import { settingSyncQueue } from "../settings/helper/sync-queue"
import { OnboardingFlow } from "./onboarding-flow"

export function GuideModalContent({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    return () => {
      // Sync settings on the way out so the user's onboarding selections persist.
      settingSyncQueue.replaceRemote("general").catch((error) => {
        console.error("Failed to sync settings after onboarding", error)
      })
    }
  }, [])

  return <OnboardingFlow onClose={onClose} />
}
