import { initializeDayjs } from "@follow/components/dayjs"
import { registerGlobalContext } from "@follow/shared/bridge"
import { DEV, ELECTRON_BUILD, IN_ELECTRON } from "@follow/shared/constants"
import { hydrateDatabaseToStore } from "@follow/store/hydrate"
import { useUserStore } from "@follow/store/user/store"
import { repository } from "@pkg"
import { enableMapSet } from "immer"

import { initI18n } from "~/i18n"
import { ElectronCloseEvent, ElectronShowEvent } from "~/providers/invalidate-query-provider"

import { subscribeNetworkStatus } from "../atoms/network"
import { appLog } from "../lib/log"
import { registerHistoryStack } from "./history"
import { doMigration } from "./migrates"
import { initSentry } from "./sentry"
import { initializeSettings } from "./settings"

declare global {
  interface Window {
    version: string
  }
}

interface AppInitializationMetrics {
  dataHydratedTime: number
  loadingTime: number
}

let appInitializationMetrics: AppInitializationMetrics | undefined

export const initializeApp = async () => {
  appLog(`${APP_NAME}: Follow everything in one place`, repository.url)

  if (DEV) {
    const url = "/favicon-dev.ico"

    // Change favicon
    const $icon = document.head.querySelector("link[rel='icon']")
    if ($icon) {
      $icon.setAttribute("href", url)
    } else {
      const icon = document.createElement("link")
      icon.setAttribute("rel", "icon")
      icon.setAttribute("href", url)
      document.head.append(icon)
    }
  }

  appLog(`Initialize ${APP_NAME}...`)
  window.version = APP_VERSION

  const now = Date.now()
  initializeDayjs()
  registerHistoryStack()
  // Set Environment
  document.documentElement.dataset.buildType = ELECTRON_BUILD ? "electron" : "web"

  // Register global context for electron
  registerGlobalContext({
    /**
     * Electron app only
     */
    onWindowClose() {
      document.dispatchEvent(new ElectronCloseEvent())
    },
    onWindowShow() {
      document.dispatchEvent(new ElectronShowEvent())
    },
  })

  apm("migration", doMigration)

  // Enable Map/Set in immer
  enableMapSet()

  subscribeNetworkStatus()

  await apm("initializeSettings", initializeSettings)

  initSentry()

  // Database hydration and locale setup are independent. Both are required by
  // the first screen, so start them together instead of serializing them.
  const hydrationStartedAt = Date.now()
  const [dataHydratedTime] = await Promise.all([
    apm("hydrateDatabaseToStore", () => {
      return hydrateDatabaseToStore({
        migrateDatabase: true,
      })
    }).then(() => Date.now() - hydrationStartedAt),
    apm("i18n", initI18n),
  ])

  const loadingTime = Date.now() - now
  appInitializationMetrics = { dataHydratedTime, loadingTime }
  appLog(`Initialize ${APP_NAME} done,`, `${loadingTime}ms`)
}

export const initializeDeferredApp = async () => {
  const tasks: Promise<unknown>[] = [
    apm("hydrate chat sessions", async () => {
      const { hydrateSessionsFromLocalDb } = await import("~/modules/ai-chat-session/store")
      await hydrateSessionsFromLocalDb()
    }),
    apm("initAnalytics", async () => {
      const { initAnalytics } = await import("./analytics")
      await initAnalytics()
    }),
  ]

  // Settings sync hits authenticated endpoints; logged-out visitors skip it
  // (it is kicked off again by handleSessionChanges after login).
  if (useUserStore.getState().whoami) {
    tasks.push(
      apm("setting sync", async () => {
        const { settingSyncQueue } = await import("~/modules/settings/helper/sync-queue")
        await settingSyncQueue.init()
        await settingSyncQueue.syncLocal()
      }),
    )
  }

  const results = await Promise.allSettled(tasks)
  for (const result of results) {
    if (result.status === "rejected") {
      appLog("Deferred initialization failed", result.reason)
    }
  }

  const metrics = appInitializationMetrics
  if (!metrics) return

  const { tracker } = await import("@follow/tracker")

  tracker.appInit({
    electron: IN_ELECTRON,
    loading_time: metrics.loadingTime,
    data_hydrated_time: metrics.dataHydratedTime,
    version: APP_VERSION,
    rn: false,
  })
}

const apm = async <T>(label: string, fn: () => Promise<T> | T): Promise<T> => {
  const start = Date.now()
  const result = await fn()
  const end = Date.now()
  appLog(`${label} took ${end - start}ms`)
  return result
}
