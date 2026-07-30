import { useDroppable } from "@dnd-kit/core"
import { useGlobalFocusableScopeSelector } from "@follow/components/common/Focusable/hooks.js"
import { FeedViewType, getView } from "@follow/constants"
import { cn } from "@follow/utils/utils"
import type { FC, ReactNode } from "react"
import { startTransition, useCallback, useRef } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { useTranslation } from "react-i18next"

import { MenuItemText, useShowContextMenu } from "~/atoms/context-menu"
import { setUISetting } from "~/atoms/settings/ui"
import { FocusablePresets } from "~/components/common/Focusable"
import { useNavigateEntry } from "~/hooks/biz/useNavigateEntry"
import { parseView, useRouteParamsSelector } from "~/hooks/biz/useRouteParams"
import { useTimelineList } from "~/hooks/biz/useTimelineList"
import { useContextMenu } from "~/hooks/common/useContextMenu"

import { resetSelectedFeedIds } from "./atom"
import { useShowTimelineTabsSettingsModal } from "./TimelineTabsSettingsModal"

/**
 * The Views grid gives each tab ~48px, where "Social Media" and "Notifications"
 * truncate. Map to the short variants; the full name stays in the tooltip.
 */
const shortViewLabelKey = (name: string) =>
  name.replace("feed_view_type.", "feed_view_type_short.") as "feed_view_type_short.all"

export function SubscriptionTabButton({
  timelineId,
  shortcut,
}: {
  timelineId: string
  shortcut: string
}) {
  const activeTimelineId = useRouteParamsSelector((s) => s.timelineId)

  const isActive = activeTimelineId === timelineId
  const navigate = useNavigateEntry()
  const navigateToTimeline = useCallback(
    (nextTimelineId: string) => {
      navigate({
        timelineId: nextTimelineId,
        feedId: null,
        entryId: null,
      })
      resetSelectedFeedIds()
    },
    [navigate],
  )
  const setActive = useCallback(() => {
    navigateToTimeline(timelineId)
  }, [navigateToTimeline, timelineId])

  const view = parseView(timelineId)

  if (view === FeedViewType.All) {
    return (
      <ViewAllSwitchButton
        timelineId={timelineId}
        isActive={isActive}
        setActive={setActive}
        shortcut={shortcut}
        navigateToTimeline={navigateToTimeline}
      />
    )
  } else if (typeof view === "number") {
    return (
      <ViewSwitchButton
        view={view}
        timelineId={timelineId}
        isActive={isActive}
        setActive={setActive}
        shortcut={shortcut}
        navigateToTimeline={navigateToTimeline}
      />
    )
  }
}

const useSubscriptionTabContextMenu = ({
  timelineId,
  isActive,
  navigateToTimeline,
}: {
  timelineId: string
  isActive: boolean
  navigateToTimeline: (timelineId: string) => void
}) => {
  const { t } = useTranslation()
  const showContextMenu = useShowContextMenu()
  const showTimelineTabsSettingsModal = useShowTimelineTabsSettingsModal()
  const visibleTimelineList = useTimelineList({ withAll: false, visible: true })
  const hiddenTimelineList = useTimelineList({ withAll: false, hidden: true })

  const canHide = visibleTimelineList.filter((id) => id !== timelineId).length > 0

  const handleHide = useCallback(() => {
    if (!canHide) return

    const nextVisible = visibleTimelineList.filter((id) => id !== timelineId)
    const nextHidden = hiddenTimelineList.filter((id) => id !== timelineId).concat(timelineId)
    setUISetting("timelineTabs", {
      visible: nextVisible,
      hidden: nextHidden,
    })

    if (isActive) {
      const currentIndex = visibleTimelineList.indexOf(timelineId)
      const fallbackTimelineId =
        nextVisible[currentIndex] ?? nextVisible[currentIndex - 1] ?? nextVisible[0]

      if (fallbackTimelineId) {
        navigateToTimeline(fallbackTimelineId)
      }
    }
  }, [canHide, hiddenTimelineList, isActive, navigateToTimeline, timelineId, visibleTimelineList])

  const contextMenuProps = useContextMenu({
    onContextMenu: async (event) => {
      event.preventDefault()
      event.stopPropagation()
      await showContextMenu(
        [
          new MenuItemText({
            label: t("sidebar.timeline_tabs.hide_tab"),
            click: handleHide,
            disabled: !canHide,
          }),
          new MenuItemText({
            label: t("sidebar.timeline_tabs.customize"),
            click: showTimelineTabsSettingsModal,
          }),
        ],
        event,
      )
    },
  })

  return contextMenuProps
}

const ViewAllSwitchButton: FC<{
  timelineId: string
  isActive: boolean
  setActive: () => void
  shortcut: string
  navigateToTimeline: (timelineId: string) => void
}> = ({ timelineId, isActive, setActive, shortcut, navigateToTimeline }) => {
  const { t } = useTranslation()
  const item = getView(FeedViewType.All)
  const contextMenuProps = useSubscriptionTabContextMenu({
    timelineId,
    isActive,
    navigateToTimeline,
  })

  return (
    <TimelineNavButton
      label={t(shortViewLabelKey(item.name), { ns: "common" })}
      fullLabel={t(item.name, { ns: "common" })}
      icon={item.icon}
      isActive={isActive}
      shortcut={shortcut}
      {...contextMenuProps}
      onClick={(e) => {
        startTransition(() => {
          setActive()
        })
        e.stopPropagation()
      }}
    />
  )
}

const ViewSwitchButton: FC<{
  view: FeedViewType
  timelineId: string
  isActive: boolean
  setActive: () => void
  shortcut: string
  navigateToTimeline: (timelineId: string) => void
}> = ({ view, timelineId, isActive, setActive, shortcut, navigateToTimeline }) => {
  const { t } = useTranslation()
  const item = getView(view)

  const { isOver, setNodeRef } = useDroppable({
    id: `view-${item.name}`,
    data: {
      view: item.view,
    },
  })
  const contextMenuProps = useSubscriptionTabContextMenu({
    timelineId,
    isActive,
    navigateToTimeline,
  })

  return (
    <TimelineNavButton
      nodeRef={setNodeRef}
      label={t(shortViewLabelKey(item.name), { ns: "common" })}
      fullLabel={t(item.name, { ns: "common" })}
      icon={item.icon}
      isActive={isActive}
      shortcut={shortcut}
      className={isOver ? "bg-accent/15 ring-1 ring-inset ring-accent/40" : undefined}
      {...contextMenuProps}
      onClick={(e) => {
        startTransition(() => {
          setActive()
        })
        e.stopPropagation()
      }}
    />
  )
}

const TimelineNavButton: FC<{
  label: string
  /** Full, untruncated view name for the tooltip. */
  fullLabel: string
  icon: ReactNode
  isActive: boolean
  shortcut: string
  className?: string
  nodeRef?: (node: HTMLElement | null) => void
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void
  onTouchStart?: (event: React.TouchEvent<HTMLButtonElement>) => void
  onTouchMove?: (event: React.TouchEvent<HTMLButtonElement>) => void
  onTouchEnd?: (event: React.TouchEvent<HTMLButtonElement>) => void
}> = ({
  label,
  fullLabel,
  icon,
  isActive,
  shortcut,
  className,
  nodeRef,
  onClick,
  onContextMenu,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  // Keep the timeline number shortcuts alive: ActionButton used to register
  // them from its `shortcut` prop, and this plain button replaced it.
  const inScope = useGlobalFocusableScopeSelector(FocusablePresets.isNotFloatingLayerScope)
  useHotkeys(shortcut, () => buttonRef.current?.click(), {
    preventDefault: true,
    enabled: inScope,
  })

  return (
    <button
      ref={(node) => {
        buttonRef.current = node
        nodeRef?.(node)
      }}
      type="button"
      title={`${fullLabel} (${shortcut})`}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group relative flex min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 pb-1.5 pt-2",
        "text-[1.05rem] transition-colors duration-150",
        isActive ? "bg-accent text-accent-fg" : "text-text-secondary hover:bg-fill hover:text-text",
        className,
      )}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <span className="flex size-[17px] items-center justify-center">{icon}</span>
      <span className="w-full truncate text-center text-[9.5px] font-semibold leading-none tracking-tight">
        {label}
      </span>
    </button>
  )
}
