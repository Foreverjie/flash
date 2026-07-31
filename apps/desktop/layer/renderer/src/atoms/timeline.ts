import { atom } from "jotai"

import { createAtomHooks } from "~/lib/jotai"

// "Today" is a scope toggle that narrows whatever timeline is showing (a feed,
// a folder, a view) to entries published today. It composes with the
// unread/all read-state filter instead of replacing the feed selection.
export const [, , useTimelineTodayOnly, , getTimelineTodayOnly, setTimelineTodayOnly] =
  createAtomHooks(atom(false))
