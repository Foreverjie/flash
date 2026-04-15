import { FeedViewType } from "@follow/constants"
import { atom } from "jotai"

export const mobileDrawerOpenAtom = atom(false)

// Active view type for the home feed filter chips
export const mobileActiveViewAtom = atom<FeedViewType>(FeedViewType.Articles)

// Scroll position atoms per tab — keyed by route path
export const mobileScrollPositionsAtom = atom<Record<string, number>>({})
