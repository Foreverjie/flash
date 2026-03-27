import { atom } from "jotai"

export const mobileDrawerOpenAtom = atom(false)

// Scroll position atoms per tab — keyed by route path
export const mobileScrollPositionsAtom = atom<Record<string, number>>({})
