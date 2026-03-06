import { Spring } from "@follow/components/constants/spring.js"
import { useMobile } from "@follow/components/hooks/useMobile.js"
import { PanelSplitter } from "@follow/components/ui/divider/index.js"
import { FeedViewType } from "@follow/constants"
import { defaultUISettings } from "@follow/shared/settings/defaults"
import { cn } from "@follow/utils"
import { isSafari } from "@follow/utils/utils"
import { AnimatePresence } from "motion/react"
import type { CSSProperties } from "react"
import { memo, useCallback, useMemo, useRef } from "react"
import { useResizable } from "react-resizable-layout"

import { getUISettings, setUISetting, useUISettingKey } from "~/atoms/settings/ui"
import { m } from "~/components/common/Motion"
import { ROUTE_ENTRY_PENDING } from "~/constants"
import { useBackHome } from "~/hooks/biz/useNavigateEntry"
import { useRouteParamsSelector } from "~/hooks/biz/useRouteParams"
import { useShowEntryDetailsColumn } from "~/hooks/biz/useShowEntryDetailsColumn"
import { EntryContentPlaceholder } from "~/modules/app-layout/entry-content/EntryContentPlaceholder"
import { EntryColumn } from "~/modules/entry-column"
import { EntryContent } from "~/modules/entry-content/components/entry-content"
import { AIEntryHeader } from "~/modules/entry-content/components/entry-header"
import { AppLayoutGridContainerProvider } from "~/providers/app-grid-layout-container-provider"
import { MainViewHotkeysProvider } from "~/providers/main-view-hotkeys-provider"

const MIN_ENTRY_WIDTH = isSafari() ? 356 : 300

const MobileTimelineLayout = () => {
  const { entryId } = useRouteParamsSelector((state) => ({
    entryId: state.entryId,
  }))
  const realEntryId = entryId === ROUTE_ENTRY_PENDING ? "" : entryId
  const backHome = useBackHome()

  if (realEntryId) {
    return (
      <div className="flex size-full flex-col">
        <div className="flex items-center border-b px-2 py-1">
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg p-2 text-accent"
            onClick={() => backHome()}
          >
            <i className="i-mgc-arrow-left-cute-re text-lg" />
            <span className="text-sm">Back</span>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EntryContent entryId={realEntryId} className="h-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex size-full flex-col">
      <EntryColumn />
    </div>
  )
}

const TimelineLayoutImpl = () => {
  const { view, entryId } = useRouteParamsSelector((state) => ({
    view: state.view,
    entryId: state.entryId,
  }))

  const isMobile = useMobile()
  const realEntryId = entryId === ROUTE_ENTRY_PENDING ? "" : entryId
  const showEntryDetailsColumn = useShowEntryDetailsColumn()
  const hasSelectedEntry = Boolean(realEntryId)

  const layoutContainerRef = useRef<HTMLDivElement>(null)
  const feedColumnWidth = useUISettingKey("feedColWidth")

  const timelineMaxWidth = useMemo(() => {
    if (typeof window === "undefined") return 600
    return Math.max((window.innerWidth - feedColumnWidth) / 2, 600)
  }, [feedColumnWidth])

  const entryColumnInitialWidth = useMemo(() => getUISettings().entryColWidth, [])
  const timelineStartDragPosition = useRef(0)

  const {
    position: timelineColumnWidth,
    separatorProps: timelineSeparatorProps,
    isDragging: isTimelineDragging,
    separatorCursor: timelineSeparatorCursor,
    setPosition: setTimelineColumnWidth,
  } = useResizable({
    axis: "x",
    min: MIN_ENTRY_WIDTH,
    max: timelineMaxWidth,
    initial: entryColumnInitialWidth,
    containerRef: layoutContainerRef as React.RefObject<HTMLElement>,
    onResizeStart({ position }) {
      timelineStartDragPosition.current = position
    },
    onResizeEnd({ position }) {
      if (position === timelineStartDragPosition.current) return
      setUISetting("entryColWidth", position)
      window.dispatchEvent(new Event("resize"))
    },
  })

  const isAllView = view === FeedViewType.All

  const showEntryContentOnRight = showEntryDetailsColumn && hasSelectedEntry
  const showEntryContentOnLeft = !showEntryDetailsColumn && hasSelectedEntry

  const entryColumnStyle: CSSProperties = showEntryDetailsColumn
    ? {
        flexBasis: timelineColumnWidth,
        minWidth: MIN_ENTRY_WIDTH,
      }
    : {
        minWidth: MIN_ENTRY_WIDTH,
      }

  const resetTimelineWidth = useCallback(() => {
    setUISetting("entryColWidth", defaultUISettings.entryColWidth)
    setTimelineColumnWidth(defaultUISettings.entryColWidth)
    window.dispatchEvent(new Event("resize"))
  }, [setTimelineColumnWidth])

  if (isMobile) {
    return <MobileTimelineLayout />
  }

  return (
    <div
      className={cn(
        "relative h-full min-w-0 grow",
        isAllView ? "flex flex-col overflow-y-auto scroll-smooth" : "flex",
      )}
    >
      <div
        className={cn(
          "relative h-full min-w-0",
          isAllView ? "min-h-full w-full flex-none" : "flex-1",
        )}
      >
        <AppLayoutGridContainerProvider>
          <div ref={layoutContainerRef} className="flex h-full min-w-0">
            <div
              className={cn(
                "relative flex h-full flex-col overflow-hidden",
                showEntryDetailsColumn && "border-r",
                showEntryDetailsColumn
                  ? "flex-none transition-[flex-basis] duration-200 ease-out will-change-[flex-basis]"
                  : "min-w-0 flex-1",
                showEntryDetailsColumn && isTimelineDragging && "transition-none",
              )}
              style={entryColumnStyle}
            >
              <EntryColumn />

              {showEntryContentOnLeft && (
                <>
                  <AnimatePresence>
                    {realEntryId && (
                      <m.div
                        key="entry-header"
                        className="absolute inset-x-0 top-0 z-10"
                        initial={{ translateY: "-50px", opacity: 0 }}
                        animate={{ translateY: 0, opacity: 1 }}
                        exit={{ translateY: "-50px", opacity: 0 }}
                        transition={Spring.smooth(0.3)}
                      >
                        <AIEntryHeader entryId={realEntryId} />
                      </m.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {realEntryId && (
                      <div className="pointer-events-none absolute inset-0 z-[9] flex flex-col overflow-hidden">
                        <m.div
                          key="entry-content"
                          lcpOptimization
                          initial={{ translateY: "50px", opacity: 0, scale: 0.98 }}
                          animate={{ translateY: 0, opacity: 1, scale: 1 }}
                          exit={{ translateY: "50px", opacity: 0, scale: 0.98 }}
                          transition={Spring.smooth(0.3)}
                          className="pointer-events-auto relative flex h-0 flex-1 flex-col bg-theme-background"
                        >
                          <EntryContent entryId={realEntryId} className="h-full" />
                        </m.div>
                      </div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {showEntryDetailsColumn && (
              <>
                <PanelSplitter
                  {...timelineSeparatorProps}
                  cursor={timelineSeparatorCursor}
                  isDragging={isTimelineDragging}
                  onDoubleClick={resetTimelineWidth}
                />

                <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-theme-background">
                  {showEntryContentOnRight && realEntryId ? (
                    <div className="flex h-full flex-col overflow-hidden">
                      <div className="absolute inset-x-0 top-0 z-10">
                        <AIEntryHeader entryId={realEntryId} />
                      </div>
                      <div className="flex h-0 flex-1 flex-col overflow-hidden">
                        <EntryContent entryId={realEntryId} className="h-full" />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center justify-center px-8">
                      <EntryContentPlaceholder />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </AppLayoutGridContainerProvider>
      </div>
    </div>
  )
}

export const AIEnhancedTimelineLayout = memo(function AIEnhancedTimelineLayout() {
  return (
    <>
      <TimelineLayoutImpl />
      <MainViewHotkeysProvider />
    </>
  )
})
AIEnhancedTimelineLayout.displayName = "AIEnhancedTimelineLayout"
