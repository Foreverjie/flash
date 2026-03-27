# Mobile Web JIKE-Inspired Layout Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current desktop-adapted mobile web experience with a dedicated JIKE-inspired mobile shell featuring a bottom tab bar, type-aware feed cards, and a shared brand color system.

**Architecture:** `MobileWebShell` is a layout route component that replaces `MainDestopLayout` when `useMobile()` is true. It renders `<Outlet />` for child routes, a bottom `MobileTabBar` (visible on tab routes), and a `MobileHeader` (varies per route). Tabs are real routes (`/`, `/discover`, `/notifications`, `/profile`). The existing route tree is reused — only the layout wrapper changes.

**Tech Stack:** React 19, React Router v7 (file-based via `vite-plugin-route-builder`), Tailwind CSS, Jotai atoms, Framer Motion (`m.*` with LazyMotion), MingCute icons, existing entry/feed stores.

**Spec:** `docs/superpowers/specs/2026-03-27-mobile-web-jike-layout-redesign.md`

---

## File Map

### New files

| File                                                                                    | Responsibility                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `packages/internal/constants/src/colors.ts`                                             | Brand + semantic color tokens (shared with Expo)       |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileWebShell.tsx`                 | Layout route: header + `<Outlet />` + tab bar + drawer |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileTabBar.tsx`                   | Bottom 4-tab navigation bar                            |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileHeader.tsx`                   | Per-route header variants                              |
| `apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx`       | Tap-to-open subscription panel                         |
| `apps/desktop/layer/renderer/src/modules/mobile-web/screens/HomeFeedScreen.tsx`         | Home tab — feed card list                              |
| `apps/desktop/layer/renderer/src/modules/mobile-web/screens/DiscoverScreen.tsx`         | Discover tab — search + feed browser                   |
| `apps/desktop/layer/renderer/src/modules/mobile-web/screens/NotificationsScreen.tsx`    | Notifications tab (placeholder if no API)              |
| `apps/desktop/layer/renderer/src/modules/mobile-web/screens/ProfileScreen.tsx`          | Profile tab — user info + settings menu                |
| `apps/desktop/layer/renderer/src/modules/mobile-web/cards/BaseFeedCard.tsx`             | Shared card wrapper: source row + action bar           |
| `apps/desktop/layer/renderer/src/modules/mobile-web/cards/ArticleCard.tsx`              | Article content area                                   |
| `apps/desktop/layer/renderer/src/modules/mobile-web/cards/PodcastCard.tsx`              | Audio content area with mini player                    |
| `apps/desktop/layer/renderer/src/modules/mobile-web/cards/ImageCard.tsx`                | Image grid content area                                |
| `apps/desktop/layer/renderer/src/modules/mobile-web/cards/VideoCard.tsx`                | Video thumbnail content area                           |
| `apps/desktop/layer/renderer/src/modules/mobile-web/cards/getCardType.ts`               | FeedViewType → card type mapping                       |
| `apps/desktop/layer/renderer/src/modules/mobile-web/atoms.ts`                           | Jotai atoms for scroll position, drawer state          |
| `apps/desktop/layer/renderer/src/pages/(main)/(layer)/(mobile)/notifications/index.tsx` | Route page for `/notifications`                        |
| `apps/desktop/layer/renderer/src/pages/(main)/(layer)/(mobile)/profile/index.tsx`       | Route page for `/profile`                              |

### Modified files

| File                                                                               | Change                                                     |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/internal/constants/src/index.ts`                                         | Add `export * from "./colors"`                             |
| `apps/desktop/tailwind.config.ts`                                                  | Add brand color CSS vars + safe area spacing               |
| `apps/desktop/layer/renderer/src/pages/(main)/layout.tsx`                          | Conditional layout: `MobileWebShell` vs `MainDestopLayout` |
| `apps/desktop/layer/renderer/src/modules/entry-column/layouts/EntryListHeader.tsx` | Remove `MobileGlobalDrawerTrigger` import + usage          |
| `apps/desktop/layer/renderer/src/modules/app-layout/subview/SubviewLayout.tsx`     | Remove `MobileGlobalDrawerTrigger` import + usage          |
| `apps/desktop/layer/renderer/src/modules/public-timeline/entry-list.tsx`           | Remove `MobileGlobalDrawerTrigger` import + usage          |
| `apps/desktop/layer/renderer/src/modules/player/corner-player.tsx`                 | Add mobile bottom offset above tab bar                     |

### Deleted files

| File                                                                        | Reason                                             |
| --------------------------------------------------------------------------- | -------------------------------------------------- |
| `apps/desktop/layer/renderer/src/modules/app-layout/MobileGlobalDrawer.tsx` | Replaced by MobileWebShell + tab bar + profile tab |

---

## Task 1: Shared Brand Color Tokens

**Files:**

- Create: `packages/internal/constants/src/colors.ts`
- Modify: `packages/internal/constants/src/index.ts`

- [ ] **Step 1: Create color tokens file**

```typescript
// packages/internal/constants/src/colors.ts
export const brandColors = {
  accent: { light: "#6366F1", dark: "#818CF8" },
  accentPressed: { light: "#4F46E5", dark: "#6366F1" },
  accentTint: { light: "#EEF2FF", dark: "#1E1B4B" },
  accentMuted: { light: "#A5B4FC", dark: "#4338CA" },
} as const

export const semanticColors = {
  background: { light: "#F5F5F7", dark: "#000000" },
  cardBackground: { light: "#FFFFFF", dark: "#1C1C1E" },
  textPrimary: { light: "#1C1C1E", dark: "#F5F5F7" },
  textSecondary: { light: "#8E8E93", dark: "#8E8E93" },
  textTertiary: { light: "#AEAEB2", dark: "#636366" },
  separator: { light: "#E5E5EA", dark: "#38383A" },
  destructive: { light: "#EF4444", dark: "#EF4444" },
  success: { light: "#22C55E", dark: "#22C55E" },
} as const
```

- [ ] **Step 2: Export from constants index**

In `packages/internal/constants/src/index.ts`, add:

```typescript
export * from "./colors"
```

- [ ] **Step 3: Verify build**

Run: `cd packages/internal/constants && pnpm run build` (or `pnpm run typecheck` from root)
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/internal/constants/src/colors.ts packages/internal/constants/src/index.ts
git commit -m "feat: add shared brand color tokens to constants package"
```

---

## Task 2: Tailwind Config — Brand Colors + Safe Area

**Files:**

- Modify: `apps/desktop/tailwind.config.ts`

- [ ] **Step 1: Read the current tailwind config**

Read `apps/desktop/tailwind.config.ts` to find the exact location for `theme.extend.spacing` and `theme.extend.colors`.

- [ ] **Step 2: Add safe area spacing utilities**

In `theme.extend.spacing`, add:

```typescript
"safe-area-top": "env(safe-area-inset-top, 0px)",
"safe-area-bottom": "env(safe-area-inset-bottom, 0px)",
```

- [ ] **Step 3: Add brand color CSS custom properties**

In the Tailwind config `theme.extend.colors`, add:

```typescript
"brand-accent": "var(--fo-brand-accent)",
"brand-accent-pressed": "var(--fo-brand-accent-pressed)",
"brand-accent-tint": "var(--fo-brand-accent-tint)",
"brand-accent-muted": "var(--fo-brand-accent-muted)",
```

These CSS variables will be set by `MobileWebShell` at runtime (light/dark mode aware), so the Tailwind config just references them.

- [ ] **Step 4: Verify dev server starts**

Run: `cd apps/desktop && pnpm run dev:web`
Expected: Dev server starts without errors. The new classes are available but not yet used.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/tailwind.config.ts
git commit -m "feat: add brand color vars and safe area spacing to tailwind config"
```

---

## Task 3: MobileWebShell Layout Component

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileWebShell.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/atoms.ts`

- [ ] **Step 1: Create mobile atoms file**

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/atoms.ts
import { atom } from "jotai"

export const mobileDrawerOpenAtom = atom(false)

// Scroll position atoms per tab — keyed by route path
export const mobileScrollPositionsAtom = atom<Record<string, number>>({})
```

- [ ] **Step 2: Create MobileWebShell**

This is the layout route component. It renders:

1. CSS variables for brand colors (light/dark aware via `prefers-color-scheme` media query or the app's theme system)
2. `MobileHeader` (varies per route — built in Task 5)
3. `<Outlet />` for child routes
4. `MobileTabBar` (visible only on tab routes — built in Task 4)
5. `MobileSubscriptionDrawer` (built in Task 6)

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/MobileWebShell.tsx
import { brandColors } from "@follow/constants"
import { useIsDark } from "@follow/hooks"
import { usePrefetchSessionUser, useWhoami } from "@follow/store/user/hooks"
import { Outlet, useLocation } from "react-router"

import { AppErrorBoundary } from "~/components/common/AppErrorBoundary"
import { ErrorComponentType } from "~/components/errors/enum"
import { EntriesProvider } from "~/modules/entry-column/context/EntriesContext"

import { MobileTabBar } from "./MobileTabBar"
import { MobileHeader } from "./MobileHeader"
import { MobileSubscriptionDrawer } from "./MobileSubscriptionDrawer"

const TAB_ROUTES = ["/", "/discover", "/notifications", "/profile"]
const errorTypes = [
  ErrorComponentType.Page,
  ErrorComponentType.FeedFoundCanBeFollow,
  ErrorComponentType.FeedNotFound,
] as ErrorComponentType[]

export function MobileWebShell() {
  const location = useLocation()
  const isTabRoute = TAB_ROUTES.includes(location.pathname)
  const isDark = useIsDark()
  const user = useWhoami()
  usePrefetchSessionUser() // Init auth state, same as MainDestopLayout

  const colorVars = {
    "--fo-brand-accent": isDark ? brandColors.accent.dark : brandColors.accent.light,
    "--fo-brand-accent-pressed": isDark ? brandColors.accentPressed.dark : brandColors.accentPressed.light,
    "--fo-brand-accent-tint": isDark ? brandColors.accentTint.dark : brandColors.accentTint.light,
    "--fo-brand-accent-muted": isDark ? brandColors.accentMuted.dark : brandColors.accentMuted.light,
  } as React.CSSProperties

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-secondary-system-background"
      style={colorVars}
    >
      <MobileHeader />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <EntriesProvider>
          <AppErrorBoundary errorType={errorTypes}>
            <Outlet />
          </AppErrorBoundary>
        </EntriesProvider>
      </main>
      {isTabRoute && <MobileTabBar />}
      {user && <MobileSubscriptionDrawer />}
    </div>
  )
}
```

**Important context from `MainDestopLayout`:** The desktop layout wraps its `<Outlet />` in `EntriesProvider` (for entry store) and `AppErrorBoundary`. `MobileWebShell` must do the same. Desktop-only features we intentionally omit on mobile: `SearchCmdK`, `CmdNTrigger`, `CmdF` (keyboard shortcuts), `NewUserGuide`, `EnvironmentIndicator`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm run typecheck`
Expected: Errors for missing `MobileTabBar`, `MobileHeader`, `MobileSubscriptionDrawer` (they don't exist yet). That's fine — they're created in subsequent tasks. If there are OTHER errors, fix them.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/
git commit -m "feat: add MobileWebShell layout component and mobile atoms"
```

---

## Task 4: MobileTabBar Component

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileTabBar.tsx`

- [ ] **Step 1: Create MobileTabBar**

Bottom navigation bar with 4 icon-only links. Uses `<nav>` with `<NavLink>` for accessibility. Active link determined by current route via `aria-current="page"`.

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/MobileTabBar.tsx
import { cn } from "@follow/utils/utils"
import { NavLink } from "react-router"

const tabs = [
  { to: "/", icon: "i-mgc-home-3-cute", label: "Home" },
  { to: "/discover", icon: "i-mgc-compass-cute", label: "Discover" },
  { to: "/notifications", icon: "i-mgc-notification-cute", label: "Notifications", showBadge: true },
  { to: "/profile", icon: "i-mgc-user-3-cute", label: "Profile" },
] as const

export function MobileTabBar() {
  // TODO: Replace with actual unread count from notification store when available
  const unreadCount = 0

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-[50px] shrink-0 items-center border-t border-border bg-system-background pb-safe-area-bottom"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          aria-label={
            tab.showBadge && unreadCount > 0
              ? `${tab.label}, ${unreadCount} unread notifications`
              : tab.label
          }
          className={({ isActive }) =>
            cn(
              "relative flex flex-1 flex-col items-center justify-center py-2 transition-colors",
              isActive ? "text-brand-accent" : "text-text-tertiary",
            )
          }
        >
          {({ isActive }) => (
            <>
              <i className={cn(tab.icon + (isActive ? "-fi" : "-re"), "text-2xl")} />
              {tab.showBadge && unreadCount > 0 && (
                <span className="absolute right-1/4 top-1 size-2 rounded-full bg-brand-accent" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 2: Verify it renders**

This can't be verified in isolation yet (needs route wiring in Task 8). For now, verify TypeScript:
Run: `pnpm run typecheck`
Expected: `MobileTabBar` has no type errors of its own.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/MobileTabBar.tsx
git commit -m "feat: add MobileTabBar bottom navigation component"
```

---

## Task 5: MobileHeader Component

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileHeader.tsx`

- [ ] **Step 1: Create MobileHeader**

Header varies by current route. Uses `useLocation()` to determine which variant to show. Non-tab routes (drill-in) show a back arrow + title.

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/MobileHeader.tsx
import { useSetAtom } from "jotai"
import { useLocation, useNavigate } from "react-router"

import { mobileDrawerOpenAtom } from "./atoms"

const TAB_ROUTES = ["/", "/discover", "/notifications", "/profile"]

export function MobileHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const setDrawerOpen = useSetAtom(mobileDrawerOpenAtom)

  const pathname = location.pathname

  // Drill-in header (non-tab routes)
  if (!TAB_ROUTES.includes(pathname)) {
    return (
      <header className="flex h-11 shrink-0 items-center gap-2 px-4 pt-safe-area-top">
        <button
          type="button"
          aria-label="Go back"
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
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
      <header className="flex h-11 shrink-0 items-center justify-between px-4 pt-safe-area-top">
        <button
          type="button"
          aria-label="Open subscriptions"
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
          onClick={() => setDrawerOpen(true)}
        >
          <i className="i-mgc-menu-cute-re text-xl" />
        </button>
        <span className="text-base font-semibold text-text">Flash</span>
        <button
          type="button"
          aria-label="Search"
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
        >
          <i className="i-mgc-search-cute-re text-xl" />
        </button>
      </header>
    )
  }

  // Discover header
  if (pathname === "/discover") {
    return (
      <header className="flex h-11 shrink-0 items-center px-4 pt-safe-area-top">
        <div className="flex h-9 flex-1 items-center rounded-full bg-fill-tertiary px-3 text-sm text-text-tertiary">
          <i className="i-mgc-search-cute-re mr-2" />
          Search feeds, topics...
        </div>
      </header>
    )
  }

  // Notifications header
  if (pathname === "/notifications") {
    return (
      <header className="flex h-11 shrink-0 items-center justify-center px-4 pt-safe-area-top">
        <span className="text-base font-semibold text-text">Notifications</span>
      </header>
    )
  }

  // Profile header
  if (pathname === "/profile") {
    return (
      <header className="flex h-11 shrink-0 items-center justify-between px-4 pt-safe-area-top">
        <div />
        <span className="text-base font-semibold text-text">Profile</span>
        <button
          type="button"
          aria-label="Settings"
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
        >
          <i className="i-mgc-settings-7-cute-re text-xl" />
        </button>
      </header>
    )
  }

  return null
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/MobileHeader.tsx
git commit -m "feat: add MobileHeader with per-route variants"
```

---

## Task 6: MobileSubscriptionDrawer

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx`

- [ ] **Step 1: Read existing SubscriptionColumn internals**

Read these files to understand what to reuse:

- `apps/desktop/layer/renderer/src/modules/subscription-column/index.tsx`
- `apps/desktop/layer/renderer/src/modules/subscription-column/SubscriptionList.tsx` (or similar — find the actual list component)

The drawer needs to render the feed/folder list. Identify the component that renders the subscription list without the sidebar chrome (header, resizer, etc.).

- [ ] **Step 2: Create MobileSubscriptionDrawer**

Overlay drawer that slides from the left. Uses Framer Motion `m.div` for animation. Opened via `mobileDrawerOpenAtom`.

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx
import { useAtom } from "jotai"
import { AnimatePresence, m } from "motion/react"

import { mobileDrawerOpenAtom } from "./atoms"
// Import the subscription list component identified in Step 1.
// The reusable component is likely SubscriptionList or the feed item list
// inside SubscriptionColumn. Read these to find the right one:
//   - ~/modules/subscription-column/index.tsx
//   - ~/modules/subscription-column/SubscriptionList.tsx (if it exists)
//   - ~/modules/subscription-column/FeedItem.tsx

export function MobileSubscriptionDrawer() {
  const [isOpen, setIsOpen] = useAtom(mobileDrawerOpenAtom)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black"
            onClick={() => setIsOpen(false)}
          />
          {/* Drawer panel */}
          <m.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-4/5 max-w-[320px] overflow-y-auto bg-system-background pt-safe-area-top"
          >
            <div className="p-4">
              <h2 className="mb-4 text-lg font-semibold text-text">Subscriptions</h2>
              {/* Render subscription list here — reuse identified component from Step 1 */}
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

Note: The codebase uses `m` and `AnimatePresence` from `motion/react` directly — no `LazyMotion` wrapper needed. The exact subscription list component to reuse depends on Step 1 exploration. If the existing list has too much desktop logic (DnD, resizing), extract just the feed/folder rendering.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/MobileSubscriptionDrawer.tsx
git commit -m "feat: add MobileSubscriptionDrawer with slide animation"
```

---

## Task 7: Feed Card Components

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/cards/getCardType.ts`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/cards/BaseFeedCard.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/cards/ArticleCard.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/cards/ImageCard.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/cards/VideoCard.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/cards/PodcastCard.tsx`

- [ ] **Step 1: Read existing entry data model and hooks**

Read these files to understand the entry data model and how to fetch entry/feed data:

- `apps/desktop/layer/renderer/src/modules/entry-column/Items/article-item.tsx` — how article entries render
- `apps/desktop/layer/renderer/src/modules/entry-column/item.tsx` — how entry items are composed
- Look for `useEntry`, `useFeedById` hooks in the store package (`packages/internal/store/`)

- [ ] **Step 2: Create getCardType utility**

Maps `FeedViewType` to card component type. Uses the enum values from `@follow/constants`:

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/cards/getCardType.ts
import { FeedViewType } from "@follow/constants"

export type CardType = "article" | "image" | "video" | "podcast"

export function getCardType(
  viewType: FeedViewType,
  entry?: { media?: Array<{ type: string }> },
): CardType {
  switch (viewType) {
    case FeedViewType.Pictures:
      return "image"
    case FeedViewType.Videos:
      return "video"
    case FeedViewType.Audios:
      return "podcast"
    case FeedViewType.Articles:
    case FeedViewType.SocialMedia:
    case FeedViewType.Notifications:
    default: {
      // Heuristic fallback for FeedViewType.All or unknown
      if (!entry?.media?.length) return "article"
      const hasVideo = entry.media.some((m) => m.type === "video")
      if (hasVideo) return "video"
      const imageCount = entry.media.filter((m) => m.type === "photo").length
      if (imageCount >= 2) return "image"
      return "article"
    }
  }
}
```

- [ ] **Step 3: Create BaseFeedCard wrapper**

Renders the source row (favicon + feed name + timestamp) and action bar (bookmark + share). The content area is provided via `children`.

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/cards/BaseFeedCard.tsx
import type { ReactNode } from "react"

import { FeedIcon } from "~/modules/feed/feed-icon" // Verify exact import path
import { RelativeTime } from "~/components/ui/datetime/index" // Verify exact import path

interface BaseFeedCardProps {
  feedId: string
  feedTitle: string
  feedIcon?: string
  entryTitle: string
  publishedAt?: string
  entryId: string
  children: ReactNode
  onClick?: () => void
}

export function BaseFeedCard({
  feedTitle,
  feedIcon,
  entryTitle,
  publishedAt,
  children,
  onClick,
}: BaseFeedCardProps) {
  return (
    <article
      className="bg-system-background cursor-pointer px-4 py-3"
      onClick={onClick}
    >
      {/* Source row */}
      <div className="mb-1.5 flex items-center gap-2">
        {feedIcon && (
          <img src={feedIcon} alt="" className="size-5 rounded-full object-cover" />
        )}
        <span className="text-[13px] font-semibold text-text-secondary">{feedTitle}</span>
        {publishedAt && (
          <span className="ml-auto text-[13px] text-text-tertiary">
            <RelativeTime date={publishedAt} />
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1.5 line-clamp-2 text-base font-bold text-text">
        {entryTitle}
      </h3>

      {/* Type-specific content area */}
      {children}

      {/* Action bar */}
      <div className="mt-2 flex items-center gap-6">
        <button type="button" aria-label="Bookmark" className="text-text-tertiary">
          <i className="i-mgc-star-cute-re text-xl" />
        </button>
        <button type="button" aria-label="Share" className="text-text-tertiary">
          <i className="i-mgc-share-forward-cute-re text-xl" />
        </button>
      </div>
    </article>
  )
}
```

Note: The exact imports for `FeedIcon` and `RelativeTime` need verification. Read the existing codebase to find the actual component paths and prop interfaces.

- [ ] **Step 4: Create ArticleCard**

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/cards/ArticleCard.tsx
interface ArticleCardContentProps {
  description?: string
  thumbnailUrl?: string
}

export function ArticleCardContent({ description, thumbnailUrl }: ArticleCardContentProps) {
  return (
    <div className="flex gap-3">
      {description && (
        <p className="min-w-0 flex-1 line-clamp-2 text-sm text-text-secondary">
          {description}
        </p>
      )}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className="size-20 shrink-0 rounded-xl object-cover"
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Create ImageCard**

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/cards/ImageCard.tsx
interface ImageCardContentProps {
  images: Array<{ url: string; blurhash?: string }>
}

export function ImageCardContent({ images }: ImageCardContentProps) {
  const displayImages = images.slice(0, 6)
  const remaining = images.length - 6

  if (displayImages.length === 1) {
    return (
      <img
        src={displayImages[0].url}
        alt=""
        className="max-h-60 w-full rounded-xl object-cover"
      />
    )
  }

  if (displayImages.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {displayImages.map((img, i) => (
          <img key={i} src={img.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {displayImages.map((img, i) => (
        <div key={i} className="relative aspect-square">
          <img src={img.url} alt="" className="size-full rounded-xl object-cover" />
          {i === 5 && remaining > 0 && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-sm font-semibold text-white">
              +{remaining}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create VideoCard**

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/cards/VideoCard.tsx
interface VideoCardContentProps {
  thumbnailUrl?: string
  duration?: number
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function VideoCardContent({ thumbnailUrl, duration }: VideoCardContentProps) {
  return (
    <div className="relative overflow-hidden rounded-xl">
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="max-h-60 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-fill-tertiary" />
      )}
      {/* Play overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
          <i className="i-mgc-play-cute-fi ml-0.5 text-xl text-white" />
        </div>
      </div>
      {/* Duration badge */}
      {duration != null && (
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Create PodcastCard**

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/cards/PodcastCard.tsx
interface PodcastCardContentProps {
  duration?: number
  entryId: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function PodcastCardContent({ duration }: PodcastCardContentProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white"
      >
        <i className="i-mgc-play-cute-fi ml-0.5 text-base" />
      </button>
      {duration != null && (
        <span className="text-sm text-text-secondary">{formatDuration(duration)}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/cards/
git commit -m "feat: add mobile feed card components (article, image, video, podcast)"
```

---

## Task 8: Tab Screen Components

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/HomeFeedScreen.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/DiscoverScreen.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/NotificationsScreen.tsx`
- Create: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/ProfileScreen.tsx`

- [ ] **Step 1: Read existing entry list and discover page logic**

Read these to understand data fetching:

- `apps/desktop/layer/renderer/src/modules/entry-column/hooks/useEntriesByView.ts`
- `apps/desktop/layer/renderer/src/modules/entry-column/context/EntriesContext.tsx`
- `apps/desktop/layer/renderer/src/modules/public-timeline/entry-list.tsx` (for unauthenticated feed)
- `apps/desktop/layer/renderer/src/modules/discover/DiscoverForm.tsx`

- [ ] **Step 2: Create HomeFeedScreen**

The home feed renders a scrollable list of feed cards. Authenticated users see their subscribed feed entries; unauthenticated users see the public timeline.

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/screens/HomeFeedScreen.tsx
import { useWhoami } from "@follow/store/user/hooks"

// This is a shell — the full implementation connects to the entry store
// and renders BaseFeedCard + type-specific content components.
// For now, create the structure and connect data in a follow-up.

export function HomeFeedScreen() {
  const user = useWhoami()

  if (!user) {
    return <PublicHomeFeed />
  }

  return <AuthenticatedHomeFeed />
}

function PublicHomeFeed() {
  return (
    <div className="flex flex-col gap-3 p-0">
      {/* TODO: Connect to public timeline API and render cards */}
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        Public feed coming soon
      </div>
    </div>
  )
}

function AuthenticatedHomeFeed() {
  return (
    <div className="flex flex-col gap-3 p-0">
      {/* TODO: Connect to entry store via useEntriesByView and render type-aware cards */}
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        Your feed is loading...
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create DiscoverScreen**

Wraps the existing Discover module components for mobile:

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/screens/DiscoverScreen.tsx

// Reuse existing discover components — they already render search + results.
// The mobile header provides the search bar, so this screen shows results/categories.

export function DiscoverScreen() {
  return (
    <div className="p-4">
      {/* TODO: Integrate existing DiscoverForm / recommendations components */}
      <div className="flex items-center justify-center py-20 text-text-tertiary">
        Discover feeds
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create NotificationsScreen**

Placeholder — depends on inbox API availability:

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/screens/NotificationsScreen.tsx
import { useWhoami } from "@follow/store/user/hooks"

export function NotificationsScreen() {
  const user = useWhoami()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <i className="i-mgc-notification-cute-re text-4xl text-text-tertiary" />
        <p className="text-text-tertiary">Sign in to see your notifications</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <i className="i-mgc-notification-cute-re text-4xl text-text-tertiary" />
      <p className="text-text-tertiary">No notifications yet</p>
    </div>
  )
}
```

- [ ] **Step 5: Create ProfileScreen**

```typescript
// apps/desktop/layer/renderer/src/modules/mobile-web/screens/ProfileScreen.tsx
import { useWhoami } from "@follow/store/user/hooks"
import { useNavigate } from "react-router"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { replaceImgUrlIfNeed } from "~/lib/img-proxy"
import { signOut } from "~/queries/auth"

export function ProfileScreen() {
  const user = useWhoami()
  const { present } = useModalStack()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <i className="i-mgc-user-3-cute-re text-4xl text-text-tertiary" />
        <p className="mb-2 text-text-tertiary">Sign in to access your profile</p>
        <button
          type="button"
          className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-white"
          onClick={() => {
            present({
              CustomModalComponent: PlainModal,
              title: "Login",
              id: "login",
              content: () => <LoginModalContent runtime="browser" />,
              clickOutsideToDismiss: true,
            })
          }}
        >
          Sign In
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {/* Avatar + name */}
      <div className="flex flex-col items-center gap-3 px-4 py-6">
        <img
          src={replaceImgUrlIfNeed(user.image || undefined)}
          alt=""
          className="size-16 rounded-full object-cover"
        />
        <div className="text-center">
          <div className="text-lg font-semibold text-text">{user.name}</div>
          {user.handle && (
            <div className="text-sm text-text-secondary">@{user.handle}</div>
          )}
        </div>
      </div>

      {/* Menu items */}
      <div className="mx-4 overflow-hidden rounded-2xl bg-system-background">
        <ProfileMenuItem icon="i-mgc-settings-7-cute-re" label="Settings" />
        <ProfileMenuItem icon="i-mgc-download-cute-re" label="Import / Export OPML" />
        <ProfileMenuItem icon="i-mgc-information-cute-re" label="About" />
      </div>

      <div className="mx-4 mt-4 overflow-hidden rounded-2xl bg-system-background">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm text-red"
          onClick={() => signOut()}
        >
          <i className="i-mgc-exit-cute-re" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

function ProfileMenuItem({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left text-sm text-text last:border-b-0"
    >
      <i className={`${icon} text-lg text-text-secondary`} />
      {label}
      <i className="i-mgc-right-cute-re ml-auto text-text-tertiary" />
    </button>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/mobile-web/screens/
git commit -m "feat: add mobile tab screen components (home, discover, notifications, profile)"
```

---

## Task 9: Route Wiring — Mobile-Conditional Layout

**Files:**

- Create: `apps/desktop/layer/renderer/src/pages/(main)/(layer)/(mobile)/notifications/index.tsx`
- Create: `apps/desktop/layer/renderer/src/pages/(main)/(layer)/(mobile)/profile/index.tsx`
- Modify: `apps/desktop/layer/renderer/src/pages/(main)/layout.tsx`
- Modify: `apps/desktop/layer/renderer/src/pages/(main)/index.sync.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/app-layout/subview/SubviewLayout.tsx`

- [ ] **Step 1: Understand the route generation pattern**

The file-based router uses `(groupName)` directories for layout groups (no URL segment). The `(main)/layout.tsx` currently exports `MainDestopLayout` as `Component` (via re-export from subscription-column/index.tsx). We need this to conditionally return `MobileWebShell` when `isMobile` is true.

Key constraint: `(mobile)` directories are pathless layout groups — they don't create URL segments. So `(mobile)/notifications/index.tsx` generates a route at `/notifications`, not `/(mobile)/notifications`. No `(mobile)/layout.tsx` is needed since these pages render directly inside the `(main)` layout.

- [ ] **Step 2: Create a conditional layout component**

Modify `apps/desktop/layer/renderer/src/pages/(main)/layout.tsx`:

Current content:

```typescript
export { MainDestopLayout as Component } from "~/modules/app-layout/subscription-column/index"
```

New content:

```typescript
import { useMobile } from "@follow/components/hooks/useMobile.js"

import { MainDestopLayout } from "~/modules/app-layout/subscription-column/index"
import { MobileWebShell } from "~/modules/mobile-web/MobileWebShell"

export function Component() {
  const isMobile = useMobile()
  if (isMobile) {
    return <MobileWebShell />
  }
  return <MainDestopLayout />
}
```

Note: Import `MainDestopLayout` from the same path as the original re-export (`~/modules/app-layout/subscription-column/index`) to preserve the re-export chain. Both components render `<Outlet />` internally, so child routes work in either case.

- [ ] **Step 3: Fix the `/` redirect for mobile**

The current `(main)/index.sync.tsx` has a `loader` that **unconditionally** redirects `/` to `/timeline/view-0/feedId/entryId`. This loader runs before React renders, so `useMobile()` is unavailable. On mobile, this redirect bypasses `HomeFeedScreen`.

**Solution:** Check `window.innerWidth` in the loader (matching the `useMobile()` breakpoint of 1024px):

Modify `apps/desktop/layer/renderer/src/pages/(main)/index.sync.tsx`:

```typescript
import { FeedViewType } from "@follow/constants"
import { useSubscriptionStore } from "@follow/store/subscription/store"
import { redirect } from "react-router"

import { getUISettings } from "~/atoms/settings/ui"
import { ROUTE_ENTRY_PENDING, ROUTE_FEED_PENDING, ROUTE_VIEW_ALL } from "~/constants"
import { computeTimelineTabLists } from "~/hooks/biz/useTimelineList"
import { HomeFeedScreen } from "~/modules/mobile-web/screens/HomeFeedScreen"

export function Component() {
  // On mobile, render HomeFeedScreen at "/"
  // On desktop, the loader redirects before this renders
  return <HomeFeedScreen />
}

export const loader = () => {
  // On mobile viewports, don't redirect — let Component render HomeFeedScreen
  if (typeof window !== "undefined" && window.innerWidth < 1024) {
    return null
  }

  const uiSettings = getUISettings()
  const subscriptionState = useSubscriptionStore.getState()

  const hasAudiosSubscription =
    subscriptionState.feedIdByView[FeedViewType.Audios].size > 0 ||
    subscriptionState.listIdByView[FeedViewType.Audios].size > 0

  const hasNotificationsSubscription =
    subscriptionState.feedIdByView[FeedViewType.Notifications].size > 0 ||
    subscriptionState.listIdByView[FeedViewType.Notifications].size > 0

  const { visible } = computeTimelineTabLists({
    timelineTabs: uiSettings.timelineTabs,
    hasAudiosSubscription,
    hasNotificationsSubscription,
  })

  const firstTimeline = visible[0] ?? ROUTE_VIEW_ALL

  return redirect(`/timeline/${firstTimeline}/${ROUTE_FEED_PENDING}/${ROUTE_ENTRY_PENDING}`)
}
```

Note: `window.innerWidth < 1024` is a raw check that mirrors `useMobile()`. This is the only place we use it outside React — it's acceptable because the loader runs once on navigation and the layout switch already happens in the React tree.

- [ ] **Step 4: Create mobile-only route pages**

Create `apps/desktop/layer/renderer/src/pages/(main)/(layer)/(mobile)/notifications/index.tsx`:

```typescript
import { NotificationsScreen } from "~/modules/mobile-web/screens/NotificationsScreen"

export function Component() {
  return <NotificationsScreen />
}
```

Create `apps/desktop/layer/renderer/src/pages/(main)/(layer)/(mobile)/profile/index.tsx`:

```typescript
import { ProfileScreen } from "~/modules/mobile-web/screens/ProfileScreen"

export function Component() {
  return <ProfileScreen />
}
```

- [ ] **Step 5: Fix `/discover` SubviewLayout conflict**

**Problem:** The existing `/discover` route is a child of `(subview)/layout.tsx`, which renders `SubviewLayout` — a full-screen overlay with its own header (back button, title, scroll area). On mobile, this wraps the Discover content inside `MobileWebShell`, creating double headers and broken UX.

**Solution:** Make `SubviewLayout` pass through on mobile — render just `<Outlet />` without its desktop chrome:

Modify `apps/desktop/layer/renderer/src/modules/app-layout/subview/SubviewLayout.tsx`:

At the top of `SubviewLayout` (the exported component, not `SubviewLayoutInner`):

```typescript
export function SubviewLayout() {
  const isMobile = useMobile() // Add import: import { useMobile } from "@follow/components/hooks/useMobile.js"

  // On mobile, skip the desktop subview chrome — MobileWebShell provides its own header
  if (isMobile) {
    return <Outlet />
  }

  return (
    <Focusable className="contents" scope={HotkeyScope.SubLayer}>
      <SubviewLayoutInner />
    </Focusable>
  )
}
```

Add imports: `useMobile` from `@follow/components/hooks/useMobile.js` and `Outlet` from `react-router` (Outlet may already be imported in the file — check first).

This means `/discover`, `/explore`, `/action`, `/rsshub` all render without SubviewLayout chrome on mobile, directly inside `MobileWebShell`'s `<Outlet />`.

- [ ] **Step 6: Verify routes generate correctly**

Run: `cd apps/desktop && pnpm run dev:web`
Check the generated `generated-routes.ts` — verify `/notifications` and `/profile` routes appear as children of the `(main)` layout group.

- [ ] **Step 7: Test in browser**

Open `http://localhost:5173` on a mobile viewport (Chrome DevTools → mobile device mode):

- Verify `MobileWebShell` renders (tab bar visible at bottom)
- Verify `/` shows `HomeFeedScreen` (NOT the timeline redirect)
- Verify tab navigation works (tap Discover → URL changes to `/discover`, no double header)
- Verify desktop viewport still shows `MainDestopLayout` with timeline redirect

- [ ] **Step 8: Commit**

```bash
git add apps/desktop/layer/renderer/src/pages/ apps/desktop/layer/renderer/src/modules/app-layout/subview/SubviewLayout.tsx
git commit -m "feat: wire mobile-conditional layout, fix / redirect, and subview passthrough"
```

---

## Task 10: Remove MobileGlobalDrawer

**Files:**

- Delete: `apps/desktop/layer/renderer/src/modules/app-layout/MobileGlobalDrawer.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/app-layout/MainDestopLayout.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/entry-column/layouts/EntryListHeader.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/app-layout/subview/SubviewLayout.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/public-timeline/entry-list.tsx`

- [ ] **Step 1: Read each file to find exact import + usage locations**

Read all 4 files that import `MobileGlobalDrawer` or `MobileGlobalDrawerTrigger`.

- [ ] **Step 2: Remove from MainDestopLayout.tsx**

Remove:

- Import of `MobileGlobalDrawerProvider` (line 26)
- The `<MobileGlobalDrawerProvider>` wrapper around the layout (lines 154, 190)

- [ ] **Step 3: Remove from EntryListHeader.tsx**

Remove import and usage of `MobileGlobalDrawerTrigger`.

- [ ] **Step 4: Remove from SubviewLayout.tsx**

Remove import and usage of `MobileGlobalDrawerTrigger`.

- [ ] **Step 5: Remove from entry-list.tsx (public-timeline)**

Remove import and usage of `MobileGlobalDrawerTrigger`.

- [ ] **Step 6: Delete MobileGlobalDrawer.tsx**

```bash
git rm apps/desktop/layer/renderer/src/modules/app-layout/MobileGlobalDrawer.tsx
```

- [ ] **Step 7: Verify no broken imports**

Run: `pnpm run typecheck`
Expected: No errors related to MobileGlobalDrawer.

- [ ] **Step 8: Verify desktop still works**

Run: `cd apps/desktop && pnpm run dev:web`
Open on desktop viewport — verify layout renders correctly without the drawer provider.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: remove MobileGlobalDrawer (replaced by MobileWebShell tab bar)"
```

---

## Task 11: Corner Player Mobile Offset

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/player/corner-player.tsx`

- [ ] **Step 1: Read corner-player.tsx**

Find how it positions itself and where to add mobile-specific bottom offset.

- [ ] **Step 2: Add mobile bottom offset**

The player needs to sit above the tab bar (50px + safe area). Find where the player's container styles are defined and add:

```typescript
// When on mobile, add bottom offset
const isMobile = useMobile()
// Add to the player container's style or className:
// style={{ bottom: isMobile ? "calc(50px + env(safe-area-inset-bottom, 0px))" : undefined }}
```

The exact implementation depends on how the player is currently positioned (read Step 1 first).

- [ ] **Step 3: Verify player doesn't overlap tab bar on mobile**

Run dev server, open mobile viewport, play an audio entry. Verify the mini player appears above the tab bar.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/player/corner-player.tsx
git commit -m "fix: offset corner player above mobile tab bar"
```

---

## Task 12: Integration Test — Full Mobile Flow

No new files. This is a manual verification task.

- [ ] **Step 1: Run typecheck**

Run: `pnpm run typecheck`
Expected: No errors.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:fix`
Expected: No errors (auto-fixes applied).

- [ ] **Step 3: Run tests**

Run: `pnpm run test`
Expected: All existing tests pass.

- [ ] **Step 4: Manual test — mobile viewport**

Open `http://localhost:5173` in Chrome DevTools mobile mode (iPhone 14 Pro, 393x852):

1. **Tab bar**: 4 icons visible at bottom, Home is highlighted
2. **Tab navigation**: Tap each tab — URL changes, content swaps, correct tab highlights
3. **Browser Back**: Navigate Home → Discover → Profile, then browser Back — returns to Discover
4. **Subscription drawer**: On Home tab, tap list icon — drawer slides in. Tap backdrop — closes.
5. **Deep link**: Directly visit `/discover` — Discover tab loads with tab bar
6. **Drill-in**: (If home feed is wired) Tap an entry — full-screen detail, tab bar hides, back arrow works
7. **Unauthenticated**: Log out — Home shows public feed, Profile shows login button, Notifications shows login prompt
8. **Desktop**: Resize to desktop width — `MainDestopLayout` renders, sidebar visible, no tab bar

- [ ] **Step 5: Commit any fixes discovered during testing**

```bash
git add -A
git commit -m "fix: address issues found during mobile integration testing"
```

---

## Task 13: Data Wiring & Deferred Spec Items

This task covers connecting the placeholder screens to real data and implementing spec features deferred from the initial shell. It can be done as a follow-up PR or in the same branch.

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/HomeFeedScreen.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/DiscoverScreen.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/NotificationsScreen.tsx`
- Modify: `apps/desktop/layer/renderer/src/modules/mobile-web/screens/ProfileScreen.tsx`

- [ ] **Step 1: Wire HomeFeedScreen to entry store**

Read existing data fetching patterns:

- `apps/desktop/layer/renderer/src/modules/entry-column/hooks/useEntriesByView.ts` — how authenticated entries are fetched
- `apps/desktop/layer/renderer/src/modules/public-timeline/entry-list.tsx` — how public timeline entries are fetched
- `apps/desktop/layer/renderer/src/modules/entry-column/item.tsx` — how entry data is accessed via `useEntry(entryId)`

Connect `AuthenticatedHomeFeed` to the entry store. Render each entry using `BaseFeedCard` + the appropriate type-specific card component based on `getCardType()`. Implement pull-to-refresh (using a simple `onRefresh` callback) and infinite scroll (using an intersection observer at the bottom).

- [ ] **Step 2: Wire DiscoverScreen to existing discover data**

Reuse components from `apps/desktop/layer/renderer/src/modules/discover/`:

- `DiscoverForm.tsx` for search
- `recommendations.tsx` for trending feeds
- Add horizontal category filter chips at the top

- [ ] **Step 3: Add skeleton loading states**

Create a `SkeletonCard` component that matches the card anatomy (gray shimmer blocks for source row, title, content area). Show skeleton cards during loading and at the bottom during infinite scroll.

- [ ] **Step 4: Add long-press context menu on cards**

Use the existing context menu system (check how desktop entry items implement context menus). On mobile, trigger via `onContextMenu` (long-press on touch devices). Menu items: Bookmark, Share, Mark as read, Open in browser.

- [ ] **Step 5: Add profile stats row**

In `ProfileScreen`, add a stats row showing Subscriptions count and Bookmarks count above the menu list. Use existing store hooks to get counts.

- [ ] **Step 6: Add notification segmented tabs**

In `NotificationsScreen`, add "All | Updates | System" segmented control at the top when authenticated. Wire to inbox API when available.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire mobile screens to data stores and add deferred spec items"
```

---

## Task Dependency Graph

```
Task 1 (colors) ───┐
Task 2 (tailwind) ──┤
                    ├── Task 3 (shell) ─┬── Task 4 (tab bar) ──┐
                    │                   ├── Task 5 (header) ────┤
                    │                   ├── Task 6 (drawer) ────┤
                    │                   └── Task 7 (cards) ─────┤
                    │                                           │
                    └───────────────────────────────────────────┴── Task 8 (screens) ── Task 9 (routing) ── Task 10 (cleanup) ── Task 11 (player) ── Task 12 (test) ── Task 13 (data wiring)
```

- Tasks 1 and 2 are independent of each other, but **both must complete before** Tasks 3-7
- Tasks 3-7 can be parallelized (but Task 3 will have typecheck errors until 4, 5, 6 exist — commit them together or create stub exports)
- Tasks 8+ are sequential
- Task 13 is a follow-up that can be a separate PR
