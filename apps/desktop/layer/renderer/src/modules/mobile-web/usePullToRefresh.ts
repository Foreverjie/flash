import type { RefObject } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

export type PullState = "none" | "pulling" | "armed" | "refreshing"

const THRESHOLD = 64
const MAX_PULL = 96
/** Resistance so the sheet trails the finger instead of tracking it 1:1. */
const RESISTANCE = 0.5

interface Options {
  /** Element that actually scrolls. Pull only arms while it is at the top. */
  scrollRef: RefObject<HTMLElement | null>
  onRefresh: () => void | Promise<unknown>
  enabled?: boolean
}

/**
 * Touch pull-to-refresh for mobile-web screens. Returns the offset the content
 * sheet should be translated by plus the state the indicator renders from.
 */
export function usePullToRefresh({ scrollRef, onRefresh, enabled = true }: Options) {
  const [offset, setOffset] = useState(0)
  const [state, setState] = useState<PullState>("none")

  const startYRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const stateRef = useRef<PullState>("none")
  const onRefreshRef = useRef(onRefresh)
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => () => clearTimeout(settleTimerRef.current), [])

  const finish = useCallback(() => {
    setState("none")
    setOffset(0)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !enabled) return

    const handleTouchStart = (e: TouchEvent) => {
      if (stateRef.current === "refreshing") return
      if (el.scrollTop > 0) return
      if (e.touches.length !== 1) return
      startYRef.current = e.touches[0]!.clientY
      activeRef.current = false
    }

    const handleTouchMove = (e: TouchEvent) => {
      const startY = startYRef.current
      if (startY == null || stateRef.current === "refreshing") return

      const delta = e.touches[0]!.clientY - startY
      if (delta <= 0) {
        if (activeRef.current) {
          activeRef.current = false
          setState("none")
          setOffset(0)
        }
        return
      }
      // Scrolled away from the top mid-gesture — hand the touch back.
      if (el.scrollTop > 0) {
        startYRef.current = null
        activeRef.current = false
        setState("none")
        setOffset(0)
        return
      }

      activeRef.current = true
      // Non-passive listener, so this keeps the browser from rubber-banding.
      if (e.cancelable) e.preventDefault()

      const pulled = Math.min(delta * RESISTANCE, MAX_PULL)
      setOffset(pulled)
      setState(pulled >= THRESHOLD ? "armed" : "pulling")
    }

    const handleTouchEnd = () => {
      const wasActive = activeRef.current
      startYRef.current = null
      activeRef.current = false
      if (!wasActive) return

      if (stateRef.current === "armed") {
        setState("refreshing")
        setOffset(THRESHOLD * 0.8)
        Promise.resolve(onRefreshRef.current()).finally(() => {
          // A refresh that resolves instantly would otherwise flash; hold the
          // spinner long enough to read as a deliberate response.
          settleTimerRef.current = setTimeout(finish, 320)
        })
        return
      }

      setState("none")
      setOffset(0)
    }

    el.addEventListener("touchstart", handleTouchStart, { passive: true })
    el.addEventListener("touchmove", handleTouchMove, { passive: false })
    el.addEventListener("touchend", handleTouchEnd, { passive: true })
    el.addEventListener("touchcancel", handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener("touchstart", handleTouchStart)
      el.removeEventListener("touchmove", handleTouchMove)
      el.removeEventListener("touchend", handleTouchEnd)
      el.removeEventListener("touchcancel", handleTouchEnd)
    }
  }, [scrollRef, enabled, finish])

  return { offset, state, threshold: THRESHOLD }
}
