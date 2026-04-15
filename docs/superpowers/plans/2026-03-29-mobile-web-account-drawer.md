# Mobile Web Account Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken subscription drawer with a compact account/settings drawer, and move view-type filtering inline on the home feed with scroll-direction-aware visibility.

**Architecture:** The `MobileSubscriptionDrawer` is deleted and replaced by `MobileAccountDrawer` (same animation, new content). The home header's hamburger icon becomes the user's avatar. `EntriesProvider` is moved from the shell into `HomeFeedScreen` so it can receive a `viewOverride` prop driven by a new `mobileActiveViewAtom`. A `ViewFilterBar` component sits at the top of the feed with scroll-direction-aware hide/show.

**Tech Stack:** React 19, Jotai, Framer Motion (`motion/react`), Tailwind CSS with Apple UIKit color tokens, existing Follow store hooks.

**Spec:** `docs/superpowers/specs/2026-03-29-mobile-web-account-drawer-design.md`

---

## File Structure

| File                                                                              | Action | Responsibility                                                                             |
| --------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `apps/desktop/layer/renderer/src/modules/mobile-web/atoms.ts`                     | Modify | Add `mobileActiveViewAtom`                                                                 |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileAccountDrawer.tsx`      | Create | Account drawer with user info, stats, nav, theme toggle, sign out                          |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileHeader.tsx`             | Modify | Replace hamburger with user avatar                                                         |
| `apps/desktop/layer/renderer/src/modules/entry-column/context/EntriesContext.tsx` | Modify | Accept optional `viewOverride` prop                                                        |
| `apps/desktop/layer/renderer/src/modules/entry-column/hooks/useEntriesByView.ts`  | Modify | Accept optional `viewOverride` parameter                                                   |
| `apps/desktop/layer/renderer/src/modules/mobile-web/screens/HomeFeedScreen.tsx`   | Modify | Add `ViewFilterBar`, wrap with `EntriesProvider`, scroll-direction logic, fix color tokens |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileWebShell.tsx`           | Modify | Swap drawer import, remove `EntriesProvider` from shell                                    |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx` | Delete | No longer needed                                                                           |

**Note on testing:** The mobile-web module has no component tests — this is a UI-only module. Verification is manual via `pnpm run dev:web` and checking the mobile layout in browser devtools.

---

### Task 1: Add `mobileActiveViewAtom`

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/atoms.ts`

- [ ] **Step 1: Add the atom**

Add the new atom to the existing atoms file:

```typescript
import { FeedViewType } from "@follow/constants"
import { atom } from "jotai"

export const mobileDrawerOpenAtom = atom(false)

// Active view type for the home feed filter chips
export const mobileActiveViewAtom = atom<FeedViewType>(FeedViewType.Articles)

// Scroll position atoms per tab — keyed by route path
export const mobileScrollPositionsAtom = atom<Record<string, number>>({})
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/zhangzijie/work/flash && pnpm run typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/atoms.ts
git commit -m "feat(mobile-web): add mobileActiveViewAtom for view filter chips"
```

---

### Task 2: Thread `viewOverride` through entries context

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/entry-column/hooks/useEntriesByView.ts`
- Modify: `apps/desktop/layer/renderer/src/modules/entry-column/context/EntriesContext.tsx`

- [ ] **Step 1: Add `viewOverride` to `useRemoteEntries`**

In `useEntriesByView.ts`, modify `useRemoteEntries` to accept an optional view override. Change line 30-31 from:

```typescript
const useRemoteEntries = (): UseEntriesReturn => {
  const { feedId, view, inboxId, listId } = useRouteParams()
```

to:

```typescript
const useRemoteEntries = (viewOverride?: FeedViewType): UseEntriesReturn => {
  const routeParams = useRouteParams()
  const feedId = routeParams.feedId
  const view = viewOverride ?? routeParams.view
  const inboxId = routeParams.inboxId
  const listId = routeParams.listId
```

- [ ] **Step 2: Add `viewOverride` to `useLocalEntries`**

In the same file, modify `useLocalEntries` (line 131-132) from:

```typescript
const useLocalEntries = (): UseEntriesReturn => {
  const { feedId, view, inboxId, listId, isCollection } = useRouteParams()
```

to:

```typescript
const useLocalEntries = (viewOverride?: FeedViewType): UseEntriesReturn => {
  const routeParams = useRouteParams()
  const feedId = routeParams.feedId
  const view = viewOverride ?? routeParams.view
  const inboxId = routeParams.inboxId
  const listId = routeParams.listId
  const isCollection = routeParams.isCollection
```

- [ ] **Step 3: Add `viewOverride` to `useEntriesByView`**

Modify the exported `useEntriesByView` function (line 241-242) from:

```typescript
export const useEntriesByView = ({ onReset }: { onReset?: () => void }) => {
  const { view, listId } = useRouteParams()

  const remoteQuery = useRemoteEntries()
  const localQuery = useLocalEntries()
```

to:

```typescript
export const useEntriesByView = ({ onReset, viewOverride }: { onReset?: () => void; viewOverride?: FeedViewType }) => {
  const routeParams = useRouteParams()
  const view = viewOverride ?? routeParams.view
  const listId = routeParams.listId

  const remoteQuery = useRemoteEntries(viewOverride)
  const localQuery = useLocalEntries(viewOverride)
```

- [ ] **Step 4: Add `viewOverride` prop to `EntriesProvider`**

In `EntriesContext.tsx`, modify the provider (line 36-38) from:

```typescript
export const EntriesProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const onResetRef = useRef<(() => void) | null>(null)
  const { view } = useRouteParams()

  const entries = useEntriesByView({
    onReset: () => {
      onResetRef.current?.()
    },
  })
```

to:

```typescript
export const EntriesProvider: React.FC<React.PropsWithChildren<{ viewOverride?: FeedViewType }>> = ({ children, viewOverride }) => {
  const onResetRef = useRef<(() => void) | null>(null)
  const { view: routeView } = useRouteParams()
  const view = viewOverride ?? routeView

  const entries = useEntriesByView({
    onReset: () => {
      onResetRef.current?.()
    },
    viewOverride,
  })
```

Also add the import at the top of `EntriesContext.tsx`:

```typescript
import type { FeedViewType } from "@follow/constants"
```

(This import may already exist — check before adding.)

- [ ] **Step 5: Verify typecheck**

Run: `cd /Users/zhangzijie/work/flash && pnpm run typecheck`
Expected: No new errors (all overrides are optional, existing callers are unaffected)

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/entry-column/hooks/useEntriesByView.ts \
        apps/desktop/layer/renderer/src/modules/entry-column/context/EntriesContext.tsx
git commit -m "feat(entries): add viewOverride prop to EntriesProvider and useEntriesByView"
```

---

### Task 3: Create `MobileAccountDrawer`

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileAccountDrawer.tsx`

- [ ] **Step 1: Create the drawer component**

Create `MobileAccountDrawer.tsx` with the full implementation:

```tsx
import {
  useFeedSubscriptionCount,
  useListSubscriptionCount,
} from "@follow/store/subscription/hooks"
import { useUnreadAll } from "@follow/store/unread/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { useAtom } from "jotai"
import { AnimatePresence, m } from "motion/react"
import { useNavigate } from "react-router"

import type { ColorMode } from "@follow/hooks"
import { useThemeAtomValue } from "@follow/hooks"
import { useSetTheme } from "~/hooks/common/useSyncTheme"
import { signOut } from "~/queries/auth"

import { mobileDrawerOpenAtom } from "./atoms"

export function MobileAccountDrawer() {
  const [isOpen, setIsOpen] = useAtom(mobileDrawerOpenAtom)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black"
            onClick={() => setIsOpen(false)}
          />
          <m.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-background pt-safe-area-top fixed inset-y-0 left-0 z-50 flex w-4/5 max-w-[320px] flex-col overflow-hidden"
          >
            <DrawerContent onClose={() => setIsOpen(false)} />
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

function DrawerContent({ onClose }: { onClose: () => void }) {
  const user = useWhoami()
  const navigate = useNavigate()
  const feedCount = useFeedSubscriptionCount()
  const listCount = useListSubscriptionCount()
  const totalSubs = feedCount + listCount
  const totalUnread = useUnreadAll()

  const handleNavigate = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-3">
      {/* User row */}
      <button
        type="button"
        className="flex items-center gap-3 pb-3"
        onClick={() => handleNavigate("/profile")}
      >
        {user?.image ? (
          <img src={user.image} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="bg-brand-accent flex size-10 items-center justify-center rounded-full font-semibold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <div className="text-text truncate text-sm font-semibold">{user?.name || "Unknown"}</div>
          {user?.email && <div className="text-text-tertiary truncate text-xs">{user.email}</div>}
        </div>
      </button>

      {/* Stats row */}
      <div className="border-border/50 flex gap-4 border-b pb-3 text-sm">
        <span>
          <strong className="text-text">{totalSubs}</strong>{" "}
          <span className="text-text-tertiary">subscriptions</span>
        </span>
        <span>
          <strong className="text-text">{totalUnread}</strong>{" "}
          <span className="text-text-tertiary">unread</span>
        </span>
      </div>

      {/* Nav links */}
      <div className="border-border/50 flex flex-col border-b py-1">
        <NavLink
          icon="i-mgc-star-cute-re"
          label="Bookmarks"
          onClick={() => handleNavigate("/bookmarks")}
        />
        <NavLink
          icon="i-mgc-upload-cute-re"
          label="Import OPML"
          onClick={() => handleNavigate("/discover")}
        />
        <NavLink
          icon="i-mgc-settings-7-cute-re"
          label="Settings"
          onClick={() => handleNavigate("/settings")}
        />
      </div>

      {/* Theme selector */}
      <div className="border-border/50 flex items-center justify-between border-b py-3">
        <span className="text-text text-sm">Theme</span>
        <ThemeSelector />
      </div>

      {/* Footer */}
      <div className="pb-safe-area-bottom mt-auto flex items-center justify-between pt-3">
        <button
          type="button"
          className="text-text-secondary text-sm"
          onClick={() => {
            onClose()
            signOut()
          }}
        >
          Sign out
        </button>
        <span className="text-text-quaternary text-xs">v{APP_VERSION}</span>
      </div>
    </div>
  )
}

function NavLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="active:bg-fill-secondary flex items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors"
      onClick={onClick}
    >
      <i className={cn(icon, "text-text-secondary text-lg")} />
      <span className="text-text text-sm">{label}</span>
    </button>
  )
}

const THEME_OPTIONS: { value: ColorMode; icon: string; label: string }[] = [
  { value: "light", icon: "i-mgc-sun-cute-re", label: "Light" },
  { value: "system", icon: "i-mgc-monitor-cute-re", label: "System" },
  { value: "dark", icon: "i-mgc-moon-cute-re", label: "Dark" },
]

function ThemeSelector() {
  const currentTheme = useThemeAtomValue()
  const setTheme = useSetTheme()

  return (
    <div className="bg-fill-tertiary flex gap-0.5 rounded-lg p-0.5">
      {THEME_OPTIONS.map(({ value, icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
            currentTheme === value ? "bg-background text-text shadow-sm" : "text-text-tertiary",
          )}
          onClick={() => setTheme(value)}
        >
          <i className={icon} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/zhangzijie/work/flash && pnpm run typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/MobileAccountDrawer.tsx
git commit -m "feat(mobile-web): create MobileAccountDrawer component"
```

---

### Task 4: Update header with avatar trigger

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileHeader.tsx`

- [ ] **Step 1: Replace hamburger with avatar**

Replace the entire file content of `MobileHeader.tsx`:

```tsx
import { useWhoami } from "@follow/store/user/hooks"
import { useSetAtom } from "jotai"
import { useLocation, useNavigate } from "react-router"

import { mobileDrawerOpenAtom } from "./atoms"

const TAB_ROUTES = new Set(["/", "/discover", "/notifications", "/profile"])

export function MobileHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const setDrawerOpen = useSetAtom(mobileDrawerOpenAtom)
  const user = useWhoami()

  const { pathname } = location

  // Drill-in header (non-tab routes)
  if (!TAB_ROUTES.has(pathname)) {
    return (
      <header className="pt-safe-area-top flex h-11 shrink-0 items-center gap-2 px-4">
        <button
          type="button"
          aria-label="Go back"
          className="text-text-secondary flex size-9 items-center justify-center rounded-full"
          onClick={() => navigate(-1)}
        >
          <i className="i-mgc-left-cute-re text-xl" />
        </button>
      </header>
    )
  }

  // Home header
  if (pathname === "/") {
    return (
      <header className="pt-safe-area-top flex h-11 shrink-0 items-center justify-between px-4">
        <button
          type="button"
          aria-label="Open account menu"
          className="flex size-9 items-center justify-center rounded-full"
          onClick={() => setDrawerOpen(true)}
        >
          {user?.image ? (
            <img src={user.image} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <div className="bg-brand-accent flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
        </button>
        <span className="text-text text-base font-semibold">Flash</span>
        <button
          type="button"
          aria-label="Search"
          className="text-text-secondary flex size-9 items-center justify-center rounded-full"
        >
          <i className="i-mgc-search-cute-re text-xl" />
        </button>
      </header>
    )
  }

  // Discover header
  if (pathname === "/discover") {
    return (
      <header className="pt-safe-area-top flex h-11 shrink-0 items-center px-4">
        <div className="bg-fill-tertiary text-text-tertiary flex h-9 flex-1 items-center rounded-full px-3 text-sm">
          <i className="i-mgc-search-cute-re mr-2" />
          Search feeds, topics...
        </div>
      </header>
    )
  }

  // Notifications header
  if (pathname === "/notifications") {
    return (
      <header className="pt-safe-area-top flex h-11 shrink-0 items-center justify-center px-4">
        <span className="text-text text-base font-semibold">Notifications</span>
      </header>
    )
  }

  // Profile header
  if (pathname === "/profile") {
    return (
      <header className="pt-safe-area-top flex h-11 shrink-0 items-center justify-between px-4">
        <div />
        <span className="text-text text-base font-semibold">Profile</span>
        <button
          type="button"
          aria-label="Settings"
          className="text-text-secondary flex size-9 items-center justify-center rounded-full"
        >
          <i className="i-mgc-settings-7-cute-re text-xl" />
        </button>
      </header>
    )
  }

  return null
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/zhangzijie/work/flash && pnpm run typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/MobileHeader.tsx
git commit -m "feat(mobile-web): replace hamburger menu with user avatar trigger"
```

---

### Task 5: Add `ViewFilterBar` and refactor `HomeFeedScreen`

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/HomeFeedScreen.tsx`

This is the largest task. It adds the view filter bar with scroll-direction-aware visibility, wraps the feed in its own `EntriesProvider` with the active view, and fixes the `bg-system-background` color token.

- [ ] **Step 1: Replace `HomeFeedScreen.tsx` with the updated version**

```tsx
import { FeedViewType, getViewList } from "@follow/constants"
import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { useViewWithSubscription } from "@follow/store/subscription/hooks"
import { useUnreadByView } from "@follow/store/unread/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { useAtom } from "jotai"
import { memo, useCallback, useEffect, useRef, useState } from "react"

import { RelativeTime } from "~/components/ui/datetime"
import { EntriesProvider } from "~/modules/entry-column/context/EntriesContext"
import { useEntriesActions, useEntriesState } from "~/modules/entry-column/context/EntriesContext"
import { FeedIcon } from "~/modules/feed/feed-icon"

import { mobileActiveViewAtom } from "../atoms"
import { ArticleCardContent } from "../cards/ArticleCard"
import { getCardType } from "../cards/getCardType"
import { ImageCardContent } from "../cards/ImageCard"
import { PodcastCardContent } from "../cards/PodcastCard"
import { VideoCardContent } from "../cards/VideoCard"

export function HomeFeedScreen() {
  const user = useWhoami()

  if (!user) {
    return <PublicHomeFeed />
  }

  return <AuthenticatedHomeFeedWrapper />
}

function AuthenticatedHomeFeedWrapper() {
  const [activeView] = useAtom(mobileActiveViewAtom)

  return (
    <EntriesProvider viewOverride={activeView}>
      <AuthenticatedHomeFeed />
    </EntriesProvider>
  )
}

function PublicHomeFeed() {
  return (
    <div className="text-text-tertiary flex items-center justify-center py-20">
      Sign in to see your feed
    </div>
  )
}

function ViewFilterBar({ hidden }: { hidden: boolean }) {
  const viewsWithSub = useViewWithSubscription()
  const [activeView, setActiveView] = useAtom(mobileActiveViewAtom)

  if (viewsWithSub.length <= 1) return null

  return (
    <div
      className={cn(
        "bg-background/80 sticky top-0 z-10 backdrop-blur-lg transition-transform duration-200",
        hidden && "-translate-y-full",
      )}
    >
      <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto px-4 py-2">
        {viewsWithSub.map((viewType) => {
          const viewDef = getViewList({ includeAll: true }).find((v) => v.view === viewType)
          if (!viewDef) return null
          return (
            <ViewChip
              key={viewType}
              view={viewType}
              viewDef={viewDef}
              isActive={activeView === viewType}
              onClick={() => setActiveView(viewType)}
            />
          )
        })}
      </div>
    </div>
  )
}

const ViewChip = memo(function ViewChip({
  view,
  viewDef,
  isActive,
  onClick,
}: {
  view: FeedViewType
  viewDef: { name: string; icon: React.JSX.Element; className: string }
  isActive: boolean
  onClick: () => void
}) {
  const unread = useUnreadByView(view)
  const label = viewDef.name.split(".").pop()?.replaceAll("_", " ") ?? ""

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        isActive ? "bg-fill-secondary text-text" : "text-text-tertiary",
      )}
    >
      <span className={cn("text-base", isActive && viewDef.className)}>{viewDef.icon}</span>
      <span className="capitalize">{label}</span>
      {unread > 0 && (
        <span className="bg-fill-tertiary text-text-secondary min-w-[18px] rounded-full px-1.5 text-center text-xs">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  )
})

function useScrollDirection(ref: React.RefObject<HTMLElement | null>) {
  const [hidden, setHidden] = useState(false)
  const lastScrollTop = useRef(0)

  useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return

    const handleScroll = () => {
      const { scrollTop } = el
      const delta = scrollTop - lastScrollTop.current
      if (Math.abs(delta) > 5) {
        setHidden(delta > 0 && scrollTop > 44)
      }
      lastScrollTop.current = scrollTop
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [ref])

  return hidden
}

function AuthenticatedHomeFeed() {
  const state = useEntriesState()
  const actions = useEntriesActions()
  const scrollRef = useRef<HTMLDivElement>(null)
  const filterBarHidden = useScrollDirection(scrollRef)

  const { entriesIds, isLoading, isFetchingNextPage, hasNextPage } = state

  // Infinite scroll
  useEffect(() => {
    const el = scrollRef.current?.parentElement
    if (!el) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      if (scrollHeight - scrollTop - clientHeight < 500 && hasNextPage && !isFetchingNextPage) {
        actions.fetchNextPage()
      }
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [hasNextPage, isFetchingNextPage, actions])

  if (isLoading && entriesIds.length === 0) {
    return (
      <div className="flex flex-col">
        {Array.from({ length: 6 }).map((_, i) => (
          <EntryCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (!isLoading && entriesIds.length === 0) {
    return (
      <div className="text-text-tertiary flex flex-col items-center justify-center py-20">
        <i className="i-mgc-inbox-cute-re mb-3 text-4xl" />
        <p>No entries yet</p>
        <p className="mt-1 text-sm">Subscribe to some feeds to get started</p>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex flex-col">
      <ViewFilterBar hidden={filterBarHidden} />
      {entriesIds.map((id) => (
        <EntryCard key={id} entryId={id} />
      ))}
      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <i className="i-mgc-loading-3-cute-re text-text-tertiary animate-spin text-xl" />
        </div>
      )}
      {!hasNextPage && entriesIds.length > 0 && (
        <div className="text-text-tertiary py-6 text-center text-sm">No more entries</div>
      )}
    </div>
  )
}

function EntryCard({ entryId }: { entryId: string }) {
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    description: e.description,
    publishedAt: e.publishedAt,
    feedId: e.feedId,
    media: e.media,
    attachments: e.attachments,
  }))

  const feed = useFeedById(entry?.feedId)

  if (!entry) return null

  const cardType = getCardType(FeedViewType.Articles, { media: entry.media ?? undefined })

  const thumbnailUrl = entry.media?.find((m) => m.type === "photo")?.url
  const videoThumbnail =
    entry.media?.find((m) => m.type === "video")?.preview_image_url ||
    entry.media?.find((m) => m.type === "photo")?.url
  const images =
    entry.media
      ?.filter((m) => m.type === "photo")
      .map((m) => ({ url: m.url, blurhash: m.blurhash })) ?? []
  const duration = entry.attachments?.[0]?.duration_in_seconds
    ? typeof entry.attachments[0].duration_in_seconds === "string"
      ? Number.parseFloat(entry.attachments[0].duration_in_seconds)
      : entry.attachments[0].duration_in_seconds
    : undefined

  return (
    <article className="border-border/50 bg-background cursor-pointer border-b px-4 py-3">
      {/* Source row */}
      <div className="mb-1.5 flex items-center gap-2">
        {feed && (
          <FeedIcon
            target={{
              title: feed.title,
              image: feed.image,
              siteUrl: feed.siteUrl,
              type: "feed",
            }}
            size={18}
            noMargin
          />
        )}
        <span className="text-text-secondary min-w-0 truncate text-[13px] font-medium">
          {feed?.title ?? "Unknown"}
        </span>
        {entry.publishedAt && (
          <span className="text-text-tertiary ml-auto shrink-0 text-[13px]">
            <RelativeTime date={entry.publishedAt} />
          </span>
        )}
      </div>

      {/* Title */}
      {entry.title && (
        <h3 className="text-text mb-1.5 line-clamp-2 text-[15px] leading-snug font-bold">
          {entry.title}
        </h3>
      )}

      {/* Type-specific content */}
      {cardType === "article" && (
        <ArticleCardContent
          description={entry.description ?? undefined}
          thumbnailUrl={thumbnailUrl}
        />
      )}
      {cardType === "image" && images.length > 0 && <ImageCardContent images={images} />}
      {cardType === "video" && (
        <VideoCardContent thumbnailUrl={videoThumbnail} duration={duration} />
      )}
      {cardType === "podcast" && <PodcastCardContent duration={duration} entryId={entryId} />}
    </article>
  )
}

function EntryCardSkeleton() {
  return (
    <div className="border-border/50 bg-background border-b px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="bg-fill-tertiary size-[18px] animate-pulse rounded-sm" />
        <div className="bg-fill-tertiary h-3 w-24 animate-pulse rounded" />
        <div className="bg-fill-tertiary ml-auto h-3 w-12 animate-pulse rounded" />
      </div>
      <div className="bg-fill-tertiary mb-2 h-4 w-4/5 animate-pulse rounded" />
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="bg-fill-tertiary mb-1 h-3 w-full animate-pulse rounded" />
          <div className="bg-fill-tertiary h-3 w-3/4 animate-pulse rounded" />
        </div>
        <div className="bg-fill-tertiary size-20 animate-pulse rounded-xl" />
      </div>
    </div>
  )
}
```

Key changes from the original:

- `AuthenticatedHomeFeedWrapper` wraps the feed in its own `EntriesProvider` with `viewOverride={activeView}`
- `ViewFilterBar` component with scroll-direction-aware `hidden` prop
- `useScrollDirection` hook tracks scroll delta on the parent element
- `bg-system-background` replaced with `bg-background` in `EntryCard` (line 124) and `EntryCardSkeleton` (line 175)

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/zhangzijie/work/flash && pnpm run typecheck`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/screens/HomeFeedScreen.tsx
git commit -m "feat(mobile-web): add ViewFilterBar with scroll-direction-aware visibility and fix color tokens"
```

---

### Task 6: Update `MobileWebShell` and delete old drawer

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileWebShell.tsx`
- Delete: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx`

- [ ] **Step 1: Update `MobileWebShell.tsx`**

Replace the full file:

```tsx
import { brandColors } from "@follow/constants"
import { useIsDark } from "@follow/hooks"
import { usePrefetchSessionUser, useWhoami } from "@follow/store/user/hooks"
import { Outlet, useLocation } from "react-router"

import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { CornerPlayer } from "~/modules/player/corner-player"

import { MobileAccountDrawer } from "./MobileAccountDrawer"
import { MobileHeader } from "./MobileHeader"
import { MobileTabBar } from "./MobileTabBar"

const TAB_ROUTES = new Set(["/", "/discover", "/notifications", "/profile"])
const errorTypes = [
  ErrorComponentType.Page,
  ErrorComponentType.FeedFoundCanBeFollow,
  ErrorComponentType.FeedNotFound,
] as ErrorComponentType[]

export function MobileWebShell() {
  const location = useLocation()
  const isTabRoute = TAB_ROUTES.has(location.pathname)
  const isDark = useIsDark()
  const user = useWhoami()
  usePrefetchSessionUser()

  const colorVars = {
    "--fo-brand-accent": isDark ? brandColors.accent.dark : brandColors.accent.light,
    "--fo-brand-accent-pressed": isDark
      ? brandColors.accentPressed.dark
      : brandColors.accentPressed.light,
    "--fo-brand-accent-tint": isDark ? brandColors.accentTint.dark : brandColors.accentTint.light,
    "--fo-brand-accent-muted": isDark
      ? brandColors.accentMuted.dark
      : brandColors.accentMuted.light,
  } as React.CSSProperties

  return (
    <div
      className="bg-secondary-system-background relative flex h-screen flex-col overflow-hidden"
      style={colorVars}
    >
      <MobileHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <AppErrorBoundary errorType={errorTypes}>
          <Outlet />
        </AppErrorBoundary>
      </main>
      {isTabRoute && <MobileTabBar />}
      <CornerPlayer hideControls />
      {user && <MobileAccountDrawer />}
    </div>
  )
}
```

Key changes:

- Replaced `MobileSubscriptionDrawer` import with `MobileAccountDrawer`
- Removed `EntriesProvider` wrapper from the main content (moved into `HomeFeedScreen`)

- [ ] **Step 2: Delete the old drawer**

```bash
rm apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx
```

- [ ] **Step 3: Verify typecheck**

Run: `cd /Users/zhangzijie/work/flash && pnpm run typecheck`
Expected: No new errors. No other file imports `MobileSubscriptionDrawer`.

- [ ] **Step 4: Verify lint**

Run: `cd /Users/zhangzijie/work/flash && pnpm run lint:fix`
Expected: No errors related to the changed files

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/MobileWebShell.tsx
git rm apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx
git commit -m "feat(mobile-web): swap subscription drawer for account drawer, remove EntriesProvider from shell"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Start dev server**

Run: `cd /Users/zhangzijie/work/flash/apps/desktop && pnpm run dev:web`

- [ ] **Step 2: Verify in browser**

Open the app in Chrome devtools with mobile viewport (iPhone 14 Pro or similar). Check:

1. **Home header** — left side shows user avatar (or initial letter circle), not hamburger icon
2. **Tap avatar** — drawer slides in from left with: user info, stats, nav links, theme toggle, sign out, version
3. **Theme toggle** — tapping Light/System/Dark changes the theme immediately
4. **Drawer backdrop** — tapping outside closes the drawer
5. **View filter chips** — horizontal pills appear below header if user has multiple view types
6. **Scroll down** — filter bar hides with smooth transition
7. **Scroll up** — filter bar reappears
8. **Tap a chip** — feed content changes to match the selected view type
9. **Dark mode** — all drawer and feed elements use correct dark theme colors (no white backgrounds, no invisible text)
10. **Sign out** — tapping "Sign out" in drawer works

- [ ] **Step 3: Final commit (if any fixes needed)**

If manual testing reveals issues, fix them and commit with an appropriate message.
