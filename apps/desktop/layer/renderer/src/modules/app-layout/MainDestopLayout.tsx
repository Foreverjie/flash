import { useMobile } from "@follow/components/hooks/useMobile.js"
import { IN_ELECTRON, PROD } from "@follow/shared/constants"
import { usePrefetchSessionUser, useWhoami } from "@follow/store/user/hooks"
import { preventDefault } from "@follow/utils/dom"
import type { PropsWithChildren } from "react"
import * as React from "react"
import { Suspense, useRef, useState } from "react"
import { Outlet } from "react-router"

import { setMainContainerElement, setRootContainerElement } from "~/atoms/dom"
import { useUISettingKey } from "~/atoms/settings/ui"
import { useLoginModalShow } from "~/atoms/user"
import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { ROOT_CONTAINER_ID } from "~/constants/dom"
import { EnvironmentIndicator } from "~/modules/app/EnvironmentIndicator"
import { DebugRegistry } from "~/modules/debug/registry"
import { EntriesProvider } from "~/modules/entry-column/context/EntriesContext"
import { CmdF } from "~/modules/panel/cmdf"
import { SearchCmdK } from "~/modules/panel/cmdk"
import { CmdNTrigger } from "~/modules/panel/cmdn"
import { PublicTimelineLayout } from "~/modules/public-timeline"
import { AppNotificationContainer } from "~/modules/upgrade/lazy/index"

import { NewUserGuide } from "./subscription-column/components/NewUserGuide"
import { SubscriptionColumnContainer } from "./subscription-column/SubscriptionColumn"

const errorTypes = [
  ErrorComponentType.Page,
  ErrorComponentType.FeedFoundCanBeFollow,
  ErrorComponentType.FeedNotFound,
] as ErrorComponentType[]

/**
 * MainDestopLayout Component
 *
 * The main desktop layout that serves as the primary container for the Follow application.
 * This layout is responsible for:
 * - Providing the root layout structure with subscription sidebar and main content area
 * - Handling authentication states and displaying login modals
 * - Managing error boundaries for critical app errors
 * - Rendering app-wide panels (search, commands, notifications)
 *
 * ## Layout Scenarios
 *
 * ### Scenario 1: Timeline View (/timeline/1/feed-123/entry-456)
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ MainDestopLayout                                                │
 * ├─────────────┬───────────────────────────────────────────────────┤
 * │ Subscription│ TimelineEntryTwoColumnLayout                      │
 * │ Column      ├─────────────────┬─────────────────────────────────┤
 * │             │ EntryColumn     │ EntryContentView                │
 * │ ┌─────────┐ │ ┌─────────────┐ │ ┌─────────────────────────────┐ │
 * │ │ Feeds   │ │ │ Entry List  │ │ │ Article Content             │ │
 * │ │ - Tech  │ │ │ - Article 1 │ │ │                             │ │
 * │ │ - News  │ │ │ - Article 2 │ │ │ # Article Title             │ │
 * │ │ - Blog  │ │ │ - Article 3 │ │ │ Article content here...     │ │
 * │ └─────────┘ │ └─────────────┘ │ └─────────────────────────────┘ │
 * └─────────────┴─────────────────┴─────────────────────────────────┘
 * ```
 *
 * ### Scenario 2: Discover Page (/discover)
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ MainDestopLayout                                                │
 * ├─────────────┬───────────────────────────────────────────────────┤
 * │ Subscription│ SubviewLayout (Full-screen Modal)                 │
 * │ Column      │ ┌─────────────────────────────────────────────────┐ │
 * │             │ │ ◄ Back    Discover Feeds    [Import] [Add] │ │
 * │ ┌─────────┐ │ ├─────────────────────────────────────────────────┤ │
 * │ │ Feeds   │ │ │                                             │ │
 * │ │ - Tech  │ │ │        🔍 Search for feeds...               │ │
 * │ │ - News  │ │ │                                             │ │
 * │ │ - Blog  │ │ │ ┌─────────┐ ┌─────────┐ ┌─────────┐         │ │
 * │ └─────────┘ │ │ │ Tech    │ │ News    │ │ Design  │         │ │
 * │             │ │ │ Feeds   │ │ Sources │ │ Blogs   │         │ │
 * │             │ │ └─────────┘ └─────────┘ └─────────┘         │ │
 * │             │ └─────────────────────────────────────────────────┘ │
 * └─────────────┴───────────────────────────────────────────────────┘
 * ```
 *
 * ### Scenario 3: AI Chat (/ai)
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ MainDestopLayout                                                │
 * ├─────────────┬───────────────────────────────────────────────────┤
 * │ Subscription│ AIChatLayout                                      │
 * │ Column      │ ┌─────────────────────────────────────────────────┐ │
 * │             │ │ 🤖 AI Assistant                             ⚙️ │ │
 * │ ┌─────────┐ │ ├─────────────────────────────────────────────────┤ │
 * │ │ Feeds   │ │ │ 💬 How can I help you today?                   │ │
 * │ │ - Tech  │ │ │                                             │ │
 * │ │ - News  │ │ │ 👤 Summarize my latest tech articles        │ │
 * │ │ - Blog  │ │ │                                             │ │
 * │ └─────────┘ │ │ 🤖 Here's a summary of your recent tech...  │ │
 * │             │ │                                             │ │
 * │             │ ├─────────────────────────────────────────────────┤ │
 * │             │ │ Type a message... [📎] [🎙️] [📤]            │ │
 * │             │ └─────────────────────────────────────────────────┘ │
 * └─────────────┴───────────────────────────────────────────────────┘
 * ```
 *
 * ### Scenario 4: Default View (/) - Timeline Home
 * ```
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ MainDestopLayout                                                │
 * ├─────────────┬───────────────────────────────────────────────────┤
 * │ Subscription│ Default Timeline (All Feeds)                      │
 * │ Column      │ ┌─────────────────────────────────────────────────┐ │
 * │             │ │ 📰 All Articles                             ⚙️ │ │
 * │ ┌─────────┐ │ ├─────────────────────────────────────────────────┤ │
 * │ │ 📌 Today │ │ │ [Tech Blog] New React Features              │ │
 * │ │ ⭐ Starred │ │ │ [News Site] Breaking: AI Breakthrough      │ │
 * │ │ 📚 All   │ │ │ [Design Blog] UI Trends 2024               │ │
 * │ │         │ │ │ [Tech News] JavaScript Updates              │ │
 * │ │ Feeds:  │ │ │ [Blog] How to Build Better Apps            │ │
 * │ │ • Tech  │ │ │                                             │ │
 * │ │ • News  │ │ │ Load more articles...                       │ │
 * │ │ • Design│ │ │                                             │ │
 * │ └─────────┘ │ └─────────────────────────────────────────────────┘ │
 * └─────────────┴───────────────────────────────────────────────────┘
 * ```
 *
 * ## Router Outlet Flow
 * The `<Outlet />` in this component renders different child layouts based on the current route:
 * - `/` → Default timeline view
 * - `/timeline/*` → TimelineEntryTwoColumnLayout (two-column feed reader)
 * - `/discover` → SubviewLayout (full-screen discovery)
 * - `/ai` → AIChatLayout (AI chat interface)
 * - `/power`, `/action`, `/rsshub` → SubviewLayout (utility pages)
 *
 * @component
 * @example
 * // This component is automatically rendered by React Router
 * // based on the route configuration in generated-routes.ts
 */
export function MainDestopLayout() {
  const isMobile = useMobile()
  const isAuthFail = useLoginModalShow()
  const user = useWhoami()
  const sessionQuery = usePrefetchSessionUser()

  // Show public timeline when:
  // 1. Session check completed and no user found (sessionQuery settled + no user)
  // 2. Or explicit auth failure (401 received)
  const showPublicTimeline = (sessionQuery.isFetched && !user) || (isAuthFail && !user)

  const containerRef = useRef<HTMLDivElement | null>(null)

  return (
    <RootContainer ref={containerRef}>
      {!PROD && <EnvironmentIndicator />}

      <Suspense>
        <AppNotificationContainer />
      </Suspense>

      {showPublicTimeline ? (
        // Public mode: show feeds & posts from public API without auth
        <PublicTimelineLayout />
      ) : (
        <>
          <EntriesProvider>
            {!isMobile && <SubscriptionColumnContainer />}

            <main
              ref={setMainContainerElement}
              className="flex min-w-0 flex-1 bg-theme-background pt-[calc(var(--fo-window-padding-top)_-10px)] !outline-none"
              // NOTE: tabIndex for main element can get by `document.activeElement`
              tabIndex={-1}
            >
              <AppErrorBoundary errorType={errorTypes}>
                <Outlet />
              </AppErrorBoundary>
            </main>
          </EntriesProvider>

          <NewUserGuide />
        </>
      )}

      <SearchCmdK />
      <CmdNTrigger />
      {IN_ELECTRON && <CmdF />}
    </RootContainer>
  )
}

/**
 * RootContainer Component
 *
 * The root container wrapper that:
 * - Sets up CSS custom properties for layout dimensions
 * - Provides the base container styling and dimensions
 * - Manages DOM element references for the layout system
 * - Handles context menu prevention and responsive behavior
 *
 * @param ref - Ref forwarded to the root div element
 * @param children - Child components to render within the container
 * @component
 */
const RootContainer = ({
  ref,
  children,
}: PropsWithChildren & { ref?: React.Ref<HTMLDivElement | null> }) => {
  const feedColWidth = useUISettingKey("feedColWidth")

  const [elementRef, _setElementRef] = useState<HTMLDivElement | null>(null)
  const setElementRef = React.useCallback((el: HTMLDivElement | null) => {
    _setElementRef(el)
    setRootContainerElement(el)
  }, [])
  React.useImperativeHandle(ref, () => elementRef!)
  return (
    <div
      ref={setElementRef}
      style={
        {
          "--fo-feed-col-w": `${feedColWidth}px`,
        } as any
      }
      className="relative z-0 flex h-screen overflow-hidden print:h-auto print:overflow-auto"
      onContextMenu={preventDefault}
      id={ROOT_CONTAINER_ID}
    >
      {children}
    </div>
  )
}

DebugRegistry.add("New User Guide", () => {
  import("~/modules/new-user-guide/guide-modal-content").then((m) => {
    window.presentModal({
      title: "New User Guide",
      content: ({ dismiss }) => (
        <m.GuideModalContent
          onClose={() => {
            dismiss()
          }}
        />
      ),

      CustomModalComponent: PlainModal,
      modalContainerClassName: "flex items-center justify-center",

      canClose: false,
      clickOutsideToDismiss: false,
      overlay: true,
    })
  })
})
