import type { FeedViewType } from "@follow/constants"
import { getViewList } from "@follow/constants"
import { useViewWithSubscription } from "@follow/store/subscription/hooks"
import { useUnreadByView } from "@follow/store/unread/hooks"
import { cn } from "@follow/utils/utils"
import { useAtom, useAtomValue } from "jotai"
import { memo, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { mobileActiveViewAtom, mobileViewDragProgressAtom } from "./atoms"

const ALL_VIEW_DEFS = getViewList({ includeAll: true })

// Icon-only resting width for pills that aren't selected.
const COLLAPSED_WIDTH = 44
// Pointer travel that turns a tap on the track into a pan.
const PAN_THRESHOLD_PX = 5

// Short one-word labels so every tab fits without truncating.
const shortViewLabelKey = (name: string) =>
  name.replace("feed_view_type.", "feed_view_type_short.") as "feed_view_type_short.all"

/**
 * Category switch over the home feed: a pill track holding one tab per view.
 * The selected tab expands to reveal its label on the brand accent; the rest
 * rest as icon-only pills. The track pans by drag and scrolls when the set
 * outgrows the row.
 */
export function ViewPillTrack({ hidden }: { hidden: boolean }) {
  const viewsWithSub = useViewWithSubscription()
  const [activeView, setActiveView] = useAtom(mobileActiveViewAtom)
  const dragProgress = useAtomValue(mobileViewDragProgressAtom)
  const trackRef = useRef<HTMLDivElement>(null)

  const activeIndex = viewsWithSub.indexOf(activeView)
  // While a swipe is in flight the fractional progress drives the pills; at
  // rest the selected index does, so CSS transitions can take over.
  const progress = dragProgress ?? activeIndex

  useDragToPan(trackRef)

  // Keep the expanded tab in frame when the selection moves off-screen.
  useEffect(() => {
    const track = trackRef.current
    const active = track?.querySelector<HTMLElement>("[data-active='true']")
    active?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" })
  }, [activeView])

  // Always render: with no app header above, this bar carries the status-bar
  // inset, so hiding it would push content under the notch.
  if (viewsWithSub.length === 0) return null

  return (
    <div
      className={cn(
        "sticky top-0 z-10 bg-background transition-transform duration-200",
        hidden && "-translate-y-full",
      )}
    >
      <div
        ref={trackRef}
        className="mx-3.5 mb-2.5 mt-[calc(var(--sat,0px)+0.5rem)] flex overflow-x-auto rounded-full bg-fill p-[3px] scrollbar-none"
      >
        {/* min-w-full lets the selected pill expand into the free space when the
            whole set fits, while the track still scrolls once it doesn't. */}
        <div className="flex min-w-full gap-1">
          {viewsWithSub.map((viewType, index) => {
            const viewDef = ALL_VIEW_DEFS.find((v) => v.view === viewType)
            if (!viewDef) return null
            // 1 at the pill's own index, falling to 0 at its neighbours — the
            // same triangular ramp the native pager interpolates over.
            const t = Math.max(0, 1 - Math.abs(progress - index))
            return (
              <ViewPill
                key={viewType}
                view={viewType}
                viewDef={viewDef}
                t={t}
                isActive={activeView === viewType}
                isDragging={dragProgress !== null}
                onClick={() => setActiveView(viewType)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

const ViewPill = memo(function ViewPill({
  view,
  viewDef,
  t,
  isActive,
  isDragging,
  onClick,
}: {
  view: FeedViewType
  viewDef: { name: string; icon: React.JSX.Element; className: string }
  t: number
  isActive: boolean
  isDragging: boolean
  onClick: () => void
}) {
  const { t: translate } = useTranslation("common")
  const unread = useUnreadByView(view)
  const label = translate(shortViewLabelKey(viewDef.name))
  // Reads as selected past the midpoint of a swipe, so the ink flips once
  // rather than muddying through the accent.
  const reads = t > 0.5

  return (
    <button
      type="button"
      onClick={onClick}
      data-active={isActive}
      aria-label={label}
      aria-pressed={isActive}
      style={{
        // flex-grow shares the free space between the pills a swipe sits
        // between; basis keeps the resting ones at icon width.
        flex: `${t} 0 ${COLLAPSED_WIDTH}px`,
      }}
      className={cn(
        "group relative flex h-8 items-center justify-center gap-1.5 rounded-full",
        "text-xs font-semibold outline-none",
        // Matches the design system's `.fl-tab` timing.
        !isDragging && [
          "transition-[flex,background-color,color,box-shadow] [transition-duration:180ms,180ms,180ms,250ms]",
          "[transition-timing-function:cubic-bezier(.2,.6,.2,1)]",
          "f-motion-reduce:transition-none",
        ],
        "focus-visible:outline-2 focus-visible:outline-offset-2",
        "focus-visible:outline-[color-mix(in_srgb,var(--fo-accent)_80%,currentColor)]",
        reads ? "text-accent-fg" : "text-text-secondary hover:text-text",
        !reads && "hover:bg-fill-secondary",
      )}
    >
      {/* Accent fill lives on its own layer so it can crossfade with the drag
          instead of stepping between two background colors. */}
      <span
        aria-hidden
        style={{ opacity: t }}
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full bg-accent",
          "shadow-[0_1px_4px_rgba(0,0,0,0.18)]",
          "group-hover:bg-[var(--fo-accent-hover)]",
          !isDragging &&
            "transition-[opacity,background-color] duration-200 f-motion-reduce:transition-none",
        )}
      />
      <span className="relative shrink-0 text-sm leading-none">{viewDef.icon}</span>
      {/* 0fr → 1fr animates the label out to its natural width without having
          to measure it. */}
      <span
        aria-hidden
        style={{ gridTemplateColumns: `${t}fr`, opacity: t }}
        className={cn(
          "relative grid",
          !isDragging &&
            "transition-[grid-template-columns,opacity] [transition-duration:250ms] [transition-timing-function:cubic-bezier(.2,.7,.3,1)] f-motion-reduce:transition-none",
        )}
      >
        <span className="overflow-hidden whitespace-nowrap">{label}</span>
      </span>
      {unread > 0 && (
        <span
          style={{ opacity: 1 - t }}
          className={cn(
            "pointer-events-none absolute right-2.5 top-1 size-1.5 rounded-full bg-accent",
            !isDragging && "transition-opacity duration-200 f-motion-reduce:transition-none",
          )}
        />
      )}
    </button>
  )
})

/** Click-and-drag panning for the track, so it moves without a touchscreen. */
function useDragToPan(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let pointerId: number | null = null
    let startX = 0
    let startScroll = 0
    let panned = false

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return
      pointerId = e.pointerId
      startX = e.clientX
      startScroll = el.scrollLeft
      panned = false
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      if (!panned && Math.abs(dx) < PAN_THRESHOLD_PX) return
      if (!panned) {
        panned = true
        el.setPointerCapture(e.pointerId)
        el.style.cursor = "grabbing"
      }
      el.scrollLeft = startScroll - dx
    }

    const endPan = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      el.style.cursor = ""
      pointerId = null
    }

    // Swallow the click that would otherwise land on whichever pill sits under
    // the cursor when a pan ends.
    const onClickCapture = (e: MouseEvent) => {
      if (!panned) return
      panned = false
      e.stopPropagation()
      e.preventDefault()
    }

    el.addEventListener("pointerdown", onPointerDown, { passive: true })
    el.addEventListener("pointermove", onPointerMove, { passive: true })
    el.addEventListener("pointerup", endPan, { passive: true })
    el.addEventListener("pointercancel", endPan, { passive: true })
    el.addEventListener("click", onClickCapture, { capture: true })

    return () => {
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      el.removeEventListener("pointerup", endPan)
      el.removeEventListener("pointercancel", endPan)
      el.removeEventListener("click", onClickCapture, { capture: true })
    }
  }, [ref])
}
