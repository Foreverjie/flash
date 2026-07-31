import { FeedViewType } from "@follow/constants"
import { atom } from "jotai"

export const mobileDrawerOpenAtom = atom(false)

// Active view type for the home feed filter chips
export const mobileActiveViewAtom = atom<FeedViewType>(FeedViewType.Articles)

// Fractional index of the view being swiped to, mirroring the native app's
// pager progress. `null` means no swipe is in flight, which lets the pill track
// fall back to its CSS transitions instead of frame-driven styles.
export const mobileViewDragProgressAtom = atom<number | null>(null)

// Scroll position atoms per tab — keyed by route path
export const mobileScrollPositionsAtom = atom<Record<string, number>>({})

// Active entry id for the mobile-web reader sheet. Null when no entry is open.
export const mobileReaderEntryIdAtom = atom<string | null>(null)
