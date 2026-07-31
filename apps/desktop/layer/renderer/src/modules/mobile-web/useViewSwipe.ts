import type { FeedViewType } from "@follow/constants"
import { useSetAtom } from "jotai"
import type { RefObject } from "react"
import { useEffect, useRef } from "react"

import { mobileViewDragProgressAtom } from "./atoms"

// Past this fraction of the viewport the swipe commits instead of springing back.
const COMMIT_RATIO = 0.25
// …or past this speed, so a quick flick commits without travelling far.
const COMMIT_VELOCITY = 0.5 // px/ms
// Horizontal travel before we claim the gesture from vertical scrolling.
const AXIS_LOCK_PX = 10
// Rubber-band factor applied when dragging past the first/last view.
const EDGE_RESISTANCE = 0.35

type Axis = "undecided" | "horizontal" | "vertical"

/**
 * Swipe left/right on the feed body to move between views, mirroring the pager
 * in the native app. The drag publishes fractional progress so the category
 * pills can grow and fill in step with the finger rather than snapping on
 * release.
 */
export function useViewSwipe({
  containerRef,
  views,
  activeView,
  onSelect,
}: {
  containerRef: RefObject<HTMLElement | null>
  views: FeedViewType[]
  activeView: FeedViewType
  onSelect: (view: FeedViewType) => void
}) {
  const setDragProgress = useSetAtom(mobileViewDragProgressAtom)

  // Handlers are attached once; everything mutable is read through a ref so we
  // don't tear down and rebind listeners on every render.
  const latest = useRef({ views, activeView, onSelect })
  latest.current = { views, activeView, onSelect }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let pointerId: number | null = null
    let startX = 0
    let startY = 0
    let startTime = 0
    let axis: Axis = "undecided"
    let index = 0
    let settleTimer: number | undefined

    const reset = () => {
      pointerId = null
      axis = "undecided"
    }

    // Animates back to rest from `from`, which lets a committed view slide in
    // from the side it was dragged toward rather than snapping into place.
    const settle = (from: number) => {
      window.clearTimeout(settleTimer)
      el.style.transition = "none"
      el.style.transform = `translate3d(${from}px,0,0)`
      // One frame at the offset so the browser has something to animate from.
      requestAnimationFrame(() => {
        el.style.transition = "transform .28s cubic-bezier(.2,.7,.3,1)"
        el.style.transform = "translate3d(0,0,0)"
      })
      // Landing on 0 means clearing the inline styles is a no-op, so the
      // element ends up clean without a visible jump.
      settleTimer = window.setTimeout(() => {
        el.style.transition = ""
        el.style.transform = ""
      }, 320)
    }

    const onPointerDown = (e: PointerEvent) => {
      if (pointerId !== null || e.pointerType === "mouse") return
      const { views: list, activeView: active } = latest.current
      index = list.indexOf(active)
      if (index < 0 || list.length < 2) return
      pointerId = e.pointerId
      startX = e.clientX
      startY = e.clientY
      startTime = e.timeStamp
      axis = "undecided"
      el.style.transition = ""
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (axis === "undecided") {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
        axis = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical"
        if (axis === "vertical") {
          reset()
          return
        }
      }
      if (axis !== "horizontal") return

      const { views: list } = latest.current
      const width = el.clientWidth || 1
      // Dragging left (negative dx) moves toward the next view.
      const raw = index - dx / width
      const clamped = Math.max(0, Math.min(list.length - 1, raw))
      // Past either end the content still moves, just reluctantly.
      const overshoot = raw - clamped
      const progress = clamped + overshoot * EDGE_RESISTANCE

      setDragProgress(progress)
      el.style.transform = `translate3d(${(index - progress) * width}px,0,0)`
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      if (axis !== "horizontal") {
        reset()
        return
      }

      const { views: list, onSelect: select } = latest.current
      const dx = e.clientX - startX
      const width = el.clientWidth || 1
      const elapsed = Math.max(1, e.timeStamp - startTime)
      const velocity = Math.abs(dx) / elapsed

      const wantsNext = dx < 0
      const committed =
        (Math.abs(dx) > width * COMMIT_RATIO || velocity > COMMIT_VELOCITY) &&
        (wantsNext ? index < list.length - 1 : index > 0)

      setDragProgress(null)
      if (committed) {
        select(list[wantsNext ? index + 1 : index - 1]!)
        // The incoming view enters from the side the finger was heading toward.
        settle(wantsNext ? width * 0.25 : -width * 0.25)
      } else {
        settle(e.clientX - startX)
      }
      reset()
    }

    el.addEventListener("pointerdown", onPointerDown, { passive: true })
    el.addEventListener("pointermove", onPointerMove, { passive: true })
    el.addEventListener("pointerup", onPointerUp, { passive: true })
    el.addEventListener("pointercancel", onPointerUp, { passive: true })

    return () => {
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeEventListener("pointermove", onPointerMove)
      el.removeEventListener("pointerup", onPointerUp)
      el.removeEventListener("pointercancel", onPointerUp)
      window.clearTimeout(settleTimer)
      setDragProgress(null)
    }
  }, [containerRef, setDragProgress])
}
