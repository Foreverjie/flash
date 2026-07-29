import { env } from "@follow/shared/env.desktop"
import { setPostHogTracker, tracker } from "@follow/tracker"
import type { AuthSessionResponse } from "@follow-app/client-sdk"
import posthog from "posthog-js"

import { QUERY_PERSIST_KEY } from "~/constants/app"

export const initAnalytics = async () => {
  const postHogKey = env.VITE_POSTHOG_KEY?.trim()
  if (!postHogKey) return

  setPostHogTracker(
    posthog.init(postHogKey, {
      api_host: env.VITE_POSTHOG_HOST,
      person_profiles: "identified_only",
      defaults: "2025-05-24",
    }),
  )

  await tracker.manager.appendUserProperties({
    build: ELECTRON ? "electron" : "web",
    version: APP_VERSION,
    hash: GIT_COMMIT_SHA,
    language: navigator.language,
  })

  let session: AuthSessionResponse | undefined
  try {
    const queryData = JSON.parse(window.localStorage.getItem(QUERY_PERSIST_KEY) ?? "{}") as {
      clientState?: {
        queries?: Array<{
          queryHash?: string
          state?: { data?: { data?: AuthSessionResponse } }
        }>
      }
    }
    session = queryData.clientState?.queries?.find(
      (query) => query.queryHash === JSON.stringify(["auth", "session"]),
    )?.state?.data?.data
  } catch {
    // do nothing
  }
  if (session?.user) {
    tracker.identify(session.user)
  }
}
