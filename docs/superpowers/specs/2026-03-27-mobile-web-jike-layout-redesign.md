# Mobile Web Layout Redesign — JIKE-Inspired

**Date:** 2026-03-27
**Status:** Draft
**Scope:** Mobile web app (`apps/desktop` renderer on phone browsers)

---

## Problem

The current mobile web experience has four compounding issues:

1. **Navigation is hidden** — the drawer-based nav requires tapping a small avatar in the header; not intuitive
2. **Content density is off** — feed doesn't feel tuned for mobile reading
3. **Doesn't feel like a native mobile app** — it's a shrunken desktop site with components conditionally hidden
4. **Visual style is dated** — lacks the clean, modern aesthetic of best-in-class mobile apps

## Solution

A ground-up mobile web shell inspired by JIKE (即刻) — a Chinese social/content app known for its content-first design, generous whitespace, and clean navigation. The desktop layout is completely untouched; mobile web gets its own dedicated shell.

## Design Decisions

| Decision                 | Choice                                                           | Rationale                                             |
| ------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Bottom tab bar           | 4 tabs: Home, Discover, Notifications, Profile                   | Focused for a reader app; no social "create" button   |
| Feed card system         | Type-aware cards (article, podcast, image, video)                | Flash aggregates diverse content types                |
| Accent color             | Electric Indigo `#6366F1`                                        | Vibrant, modern, distinctive identity                 |
| Subscription list access | Tap-to-open drawer from Home header icon                         | Tap-only; left-edge swipe conflicts with browser back |
| Color package location   | `packages/internal/constants`                                    | Shared between desktop web and Expo mobile            |
| Tablet behavior          | Tablets (768-1023px) get the mobile shell                        | Explicit decision; revisit later if needed            |
| Unauthenticated users    | `MobileWebShell` handles both states; Home shows public timeline | Single shell, conditional content                     |

---

## 1. App Shell & Navigation

### Bottom Tab Bar

- **4 tabs**: Home Feed | Discover | Notifications | Profile
- **Icon-only** — MingCute icons (`i-mgc-` prefix)
  - Home: `i-mgc-home-3-cute-re` / `i-mgc-home-3-cute-fi`
  - Discover: `i-mgc-compass-cute-re` / `i-mgc-compass-cute-fi`
  - Notifications: `i-mgc-notification-cute-re` / `i-mgc-notification-cute-fi`
  - Profile: `i-mgc-user-3-cute-re` / `i-mgc-user-3-cute-fi`
- Unselected: line icons, `text-text-tertiary`. Selected: filled icons, accent color (`#6366F1`)
- Fixed to bottom with `pb-safe-area-bottom` for notched devices
- Subtle top border (`border-t border-separator`), `bg-system-background`
- Height: 50px content + safe area inset
- Notification tab shows unread badge (accent-colored dot)

### Subscription Drawer

- Activated by tapping the list icon in Home tab header (tap-only — left-edge swipe conflicts with browser back gesture on iOS Safari and Android Chrome)
- Overlay panel, ~80% screen width, dimmed backdrop
- Reuses internals of existing `SubscriptionColumnContainer`
- Shows feed categories (folders) and individual feeds
- Tap feed to filter Home Feed; tap "All" to reset
- **Only accessible from the Home Feed tab**
- Spring animation for open/close (Framer Motion `m.div`)

### Per-Tab Headers

| Tab           | Left                   | Center                  | Right         |
| ------------- | ---------------------- | ----------------------- | ------------- |
| Home          | Subscription list icon | "Flash" brand           | Search icon   |
| Discover      | —                      | Search bar (full-width) | —             |
| Notifications | —                      | "Notifications"         | —             |
| Profile       | —                      | "Profile"               | Settings gear |

- All headers respect `pt-safe-area-top` for status bar

### Screen Transitions

- Tab switches: instant, no animation, content state preserved in-memory per tab
- Drill-in (entry detail, feed detail): slide from right via CSS transition
- Subscription drawer: slide from left with spring animation
- Back: top-left arrow button in drill-in header (no swipe gestures — conflicts with browser native back on iOS/Android)

### Routing Strategy

Tabs are **real routes** so that refresh, browser Back, shareability, and deep linking all work natively. `MobileWebShell` owns an `<Outlet />` where child routes render.

**Tab routes:**

| Tab           | Route            | Notes                           |
| ------------- | ---------------- | ------------------------------- |
| Home          | `/`              | Default route, matches existing |
| Discover      | `/discover`      | Matches existing desktop route  |
| Notifications | `/notifications` | New route (mobile-only for now) |
| Profile       | `/profile`       | New route (mobile-only for now) |

**How it works:**

1. `MobileWebShell` is the layout component rendered when `isMobile` is true. It renders a header, an `<Outlet />` for child content, and the bottom tab bar.
2. Tab switches call `navigate('/discover')` etc. — real router navigations that push onto browser history. This means browser Back between tabs works as expected, URLs are shareable, and refresh lands on the correct tab.
3. **In-memory state preservation**: Each tab screen component preserves its scroll position and local state via Jotai atoms (e.g., `homeFeedScrollPositionAtom`). When navigating back to a tab, the component restores its position from the atom on mount. This is cheaper and more reliable than keeping all 4 tabs mounted.
4. **Drill-in views**: When a user taps an entry card, `useNavigateEntry` pushes to the existing route (e.g., `/timeline/view-0/feedId/entryId`). This route renders inside `MobileWebShell`'s `<Outlet />`, replacing the tab content. The tab bar hides when the route does not match a known tab route.
5. **Back navigation from drill-in**: A back arrow in the drill-in header calls `navigate(-1)`. Because tabs are real history entries, this returns to the correct tab at the correct scroll position.
6. **Deep linking**: Direct URL access works natively — `/discover` renders MobileWebShell with Discover active, `/timeline/view-0/feedId/entryId` renders the entry detail with tab bar hidden.

**Route registration:**

The `/notifications` and `/profile` routes are new. They are registered in the route config as children of the `MobileWebShell` layout route. On desktop, these routes are either not registered or redirect to their desktop equivalents (settings modal, etc.). The file-based route generator may need a `mobile/` directory or platform-conditional route loading.

**Integration with `MainDestopLayout.tsx`:**

```typescript
// In the route config, MobileWebShell is a layout route for mobile:
if (isMobile) {
  return (
    <MobileWebShell>
      {/* <Outlet /> is inside MobileWebShell */}
      {/* Child routes: /, /discover, /notifications, /profile, /timeline/* */}
    </MobileWebShell>
  )
}
// Desktop path unchanged — existing <Outlet /> continues to work
```

`MobileWebShell` reads `useLocation()` to determine which tab is active (mapping pathname to tab). The tab bar highlights accordingly. Routes that don't match any tab (e.g., `/timeline/*`, `/ai`) cause the tab bar to hide.

### Unauthenticated State

`MobileWebShell` handles both authenticated and unauthenticated users:

- **Unauthenticated Home tab**: Renders the public timeline feed (same data as current `PublicTimelineLayout`, but in the new card format)
- **Unauthenticated Discover tab**: Fully functional — browse and search feeds
- **Unauthenticated Notifications tab**: Shows a login prompt ("Sign in to see your notifications")
- **Unauthenticated Profile tab**: Shows login/register form instead of profile
- **Subscription drawer**: Hidden for unauthenticated users (no subscriptions to show)
- **`MobileGlobalDrawer.tsx`**: Deleted entirely. Its functionality is absorbed by the Profile tab (settings, logout) and the subscription drawer (feed list).

### Accessibility

Since tabs are real route navigations (not in-page panels), the tab bar uses **`<nav>` with links**, not ARIA tab roles:

- Tab bar is a `<nav aria-label="Main navigation">` containing `<a>` (or `<NavLink>`) elements
- The active tab link gets `aria-current="page"`
- No `role="tablist"`, `role="tab"`, or `role="tabpanel"` — those are for in-page tab widgets, not route navigation
- All interactive elements have visible focus indicators (accent ring)

**Accessible names for icon-only elements** (all icon-only links/buttons require `aria-label`):

| Element                | `aria-label`                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| Home tab               | `"Home"`                                                              |
| Discover tab           | `"Discover"`                                                          |
| Notifications tab      | `"Notifications"`                                                     |
| Profile tab            | `"Profile"`                                                           |
| Subscription list icon | `"Open subscriptions"`                                                |
| Search icon            | `"Search"`                                                            |
| Settings gear          | `"Settings"`                                                          |
| Bookmark action        | `"Bookmark"` / `"Remove bookmark"`                                    |
| Share action           | `"Share"`                                                             |
| Notification badge     | `aria-label="N unread notifications"` on the tab, dynamically updated |
| Back arrow (drill-in)  | `"Go back"`                                                           |

---

## 2. Feed Card System

### Base Layout

- **No borders, no shadows** — cards separated by 12px whitespace gap
- White card background on light gray page background (`bg-secondary-system-background` / `#F5F5F7`)
- Horizontal padding: 16px. Vertical padding within card: 12px
- Rounded corners: 12px on all media elements

### Card Anatomy (shared across all types)

1. **Source row**: Feed favicon (20px circle) + feed name (semibold, `text-text-secondary`) + relative timestamp (right-aligned, `text-text-tertiary`)
2. **Title**: Entry title, bold, 16px, max 2 lines with ellipsis
3. **Content area**: Type-specific (see below)
4. **Action bar**: Bookmark (star) + Share — icon-only, 20px, `text-text-tertiary`, spaced evenly

### Entry Type Detection

Card type is determined **primarily by `FeedViewType`** (the feed's `view` property), with content heuristics as a secondary signal. The `FeedViewType` enum values from the codebase (`packages/internal/constants/src/enums.ts`):

| `FeedViewType`  | Value | Card type                                       |
| --------------- | ----- | ----------------------------------------------- |
| `Articles`      | 0     | Article card                                    |
| `SocialMedia`   | 1     | Article card (with image grid if media present) |
| `Pictures`      | 2     | Image card                                      |
| `Videos`        | 3     | Video card                                      |
| `Audios`        | 4     | Podcast card                                    |
| `Notifications` | 5     | Article card (compact, notification-style)      |

**Precedence rules:**

1. `FeedViewType` is the primary determinant — it controls which card component renders
2. Within a card type, content heuristics refine the layout (e.g., an Article card from a `SocialMedia` feed shows an image grid if the entry has 2+ images; otherwise it renders as a standard article)
3. Fallback: if `FeedViewType` is unknown or `All`, inspect entry content — presence of audio `enclosure` → Podcast, video `enclosure` → Video, 2+ images → Image, otherwise → Article

### Type-Aware Content Areas

**Article card:**

- 2-line text preview, `text-text-secondary`, 14px
- Optional thumbnail: right-aligned, 80x80px rounded square
- Layout: text + thumbnail side-by-side when image exists; full-width text when no image

**Podcast/Audio card:**

- Mini inline player row: play/pause button (accent, 36px circle) + duration + progress indicator
- No text preview — player row replaces it

**Image-heavy card (social feeds, galleries):**

- Image grid below title
- 1 image: full-width, max 240px height, rounded
- 2 images: side-by-side, equal width
- 3+ images: 3-column grid, square thumbnails, max 6 with "+N" overlay

**Video card:**

- Thumbnail with centered play overlay (semi-transparent dark circle + white triangle)
- Duration badge bottom-right
- Title below thumbnail

### Loading & Refresh

- Skeleton cards while loading: gray shimmer blocks matching card anatomy
- Pull-to-refresh: simple spinner in accent color
- Infinite scroll: skeleton cards at bottom

---

## 3. Visual System & Brand

### Accent Color

**Electric Indigo `#6366F1`** — vibrant, modern, tech-forward.

### Color Palette

**Light mode:**

| Token            | Value     | Usage                               |
| ---------------- | --------- | ----------------------------------- |
| `accent`         | `#6366F1` | Selected tabs, active states, CTAs  |
| `accentPressed`  | `#4F46E5` | Pressed/hover state                 |
| `accentTint`     | `#EEF2FF` | Subtle backgrounds, badges          |
| `accentMuted`    | `#A5B4FC` | Progress bars, secondary indicators |
| `background`     | `#F5F5F7` | Page background                     |
| `cardBackground` | `#FFFFFF` | Card surfaces                       |
| `textPrimary`    | `#1C1C1E` | Titles, primary content             |
| `textSecondary`  | `#8E8E93` | Source names, previews              |
| `textTertiary`   | `#AEAEB2` | Timestamps, meta                    |
| `separator`      | `#E5E5EA` | Borders when needed                 |
| `destructive`    | `#EF4444` | Errors, unsubscribe                 |
| `success`        | `#22C55E` | Sync complete, etc.                 |

**Dark mode:**

| Token            | Value     | Notes                           |
| ---------------- | --------- | ------------------------------- |
| `accent`         | `#818CF8` | Lighter for dark bg readability |
| `accentPressed`  | `#6366F1` |                                 |
| `accentTint`     | `#1E1B4B` | Dark tint                       |
| `accentMuted`    | `#4338CA` |                                 |
| `background`     | `#000000` |                                 |
| `cardBackground` | `#1C1C1E` |                                 |
| `textPrimary`    | `#F5F5F7` |                                 |
| `textSecondary`  | `#8E8E93` | Same gray works both modes      |
| `textTertiary`   | `#636366` |                                 |
| `separator`      | `#38383A` |                                 |

### Shared Color Package

New file: `packages/internal/constants/src/colors.ts`

```typescript
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

**Consumers:**

- Desktop/Web: Import tokens, map to CSS custom properties via `tailwind.config.ts`
- Expo/Mobile: Import same tokens, use in NativeWind theme or direct styles

**Scoping strategy for accent colors:**

- The `brandColors` are **new tokens added alongside** existing UIKit tokens, not replacements
- In Tailwind, they are exposed as `--fo-brand-accent`, `--fo-brand-accent-pressed`, etc.
- Mobile web components use the brand accent tokens; desktop components continue using existing UIKit accent tokens
- No class name collisions — brand tokens use the `brand-` prefix (e.g., `text-brand-accent`, `bg-brand-accent-tint`)

**Semantic color tokens** (`textPrimary`, `textSecondary`, etc.) are intentionally aligned with existing UIKit token values. Mobile web components should continue using the existing Tailwind classes (`text-text`, `text-text-secondary`, `bg-system-background`) rather than duplicating them. The `semanticColors` export exists only for Expo/Mobile consumption where UIKit Tailwind classes are not available.

### Safe Area CSS Utilities

The desktop Tailwind config needs new utilities for mobile viewport safe areas (distinct from the existing Electron `--fo-window-padding-top` variable):

```css
/* Add to apps/desktop/tailwind.config.ts theme.extend.spacing */
'safe-area-top':'env(safe-area-inset-top,0px)','safe-area-bottom': "env(safe-area-inset-bottom, 0px)";
```

Usage: `pt-safe-area-top` for headers, `pb-safe-area-bottom` for tab bar. The existing `--fo-window-padding-top` continues to be used for Electron title bar spacing.

### Typography

- System font stack (SF Pro on iOS, system sans elsewhere)
- Title: 16px semibold
- Body/preview: 14px regular
- Meta: 13px regular, secondary color
- No custom fonts

### Spacing

- 8px base unit. Increments: 4, 8, 12, 16, 24
- Card gap: 12px
- Card padding: 16px horizontal, 12px vertical
- Tab bar height: 50px + safe area
- Header height: 44px + safe area

### Corners

- Media elements: 12px radius
- Avatars/favicons: circle
- Buttons/pills: 20px (fully rounded)

---

## 4. Key Screens

### Home Feed

- **Header**: List icon (left, opens subscription drawer) + "Flash" + search icon (right)
- **Body**: Vertical scroll of type-aware cards, 12px gap
- Pull-to-refresh, infinite scroll
- **Entry detail**: Tap card → slide-right to full content view. Back via top-left arrow button (no swipe gestures)

### Discover

- **Header**: Full-width search bar, placeholder "Search feeds, topics..."
- **Body**: Horizontal category filter chips at top → feed cards below
- **Feed card**: Feed icon + name + description + subscriber count + "Subscribe" pill (accent)
- Tap feed card → feed detail with recent entries
- **Data source**: Reuses existing `/discover` page data and search API. Category chips filter by feed type. No new trending/recommendation API required — uses the same endpoints as the current desktop Discover page.

### Notifications

- **Header**: "Notifications"
- **Segmented tabs**: "All" | "Updates" (new entries) | "System"
- **List items**: Feed icon + notification text + timestamp
- Unread: accent dot indicator
- **Data source**: Uses existing inbox/notification endpoints. If inbox API is not yet implemented, this tab shows a "Coming soon" placeholder with the notification icon. This is a known dependency — the tab shell and UI are built, but content depends on backend support.

### Profile

- **Header area**: Avatar (64px, centered) + display name + email/handle
- **Stats row**: Subscriptions | Bookmarks — tappable
- **Menu list**: Settings, Theme toggle, Import/Export OPML, About, Sign Out
- Grouped list with chevron icons, subtle section separators

### Shared Interactions

- Long-press on card: context menu (Bookmark, Share, Mark as read, Open in browser)
- Haptic feedback: omitted for web (navigator.vibrate is unsupported on iOS Safari). May revisit if Expo mobile adopts this design.

---

## 5. Component Architecture

### New Files

```
apps/desktop/layer/renderer/src/modules/mobile-web/
├── MobileWebShell.tsx              # Root: tab bar + content + drawer
├── MobileTabBar.tsx                # Bottom 4-tab bar
├── MobileSubscriptionDrawer.tsx    # Tap-to-open subscription panel
├── MobileHeader.tsx                # Per-tab header variants
├── screens/
│   ├── HomeFeedScreen.tsx          # Home tab
│   ├── DiscoverScreen.tsx          # Discover tab
│   ├── NotificationsScreen.tsx     # Notifications tab
│   └── ProfileScreen.tsx           # Profile tab
└── cards/
    ├── BaseFeedCard.tsx            # Shared wrapper (source row + action bar)
    ├── ArticleCard.tsx             # Article content area
    ├── PodcastCard.tsx             # Audio with mini player
    ├── ImageCard.tsx               # Image gallery
    └── VideoCard.tsx               # Video with thumbnail overlay
```

### Shared Package Addition

```
packages/internal/constants/src/
└── colors.ts                       # Brand + semantic color tokens
```

### Integration Point

`MobileWebShell` is a **layout route component** wired through the route configuration, not rendered as a wrapper inside `MainDestopLayout`. The route tree is changed so that on mobile, `MobileWebShell` replaces `MainDestopLayout` as the layout for the same child routes.

**Route tree change (conceptual):**

```
// Current (desktop-only):
<Route element={<MainDestopLayout />}>
  <Route path="/" element={<TimelineHome />} />
  <Route path="/discover" element={<DiscoverPage />} />
  <Route path="/timeline/:timelineId/:feedId/:entryId" element={<EntryDetail />} />
  <Route path="/ai" element={<AIChat />} />
  ...
</Route>

// New (platform-conditional layout):
<Route element={isMobile ? <MobileWebShell /> : <MainDestopLayout />}>
  {/* All existing child routes remain — same paths, same components */}
  <Route path="/" element={isMobile ? <HomeFeedScreen /> : <TimelineHome />} />
  <Route path="/discover" element={isMobile ? <DiscoverScreen /> : <DiscoverPage />} />
  <Route path="/timeline/:timelineId/:feedId/:entryId" element={<EntryDetail />} />
  <Route path="/ai" element={<AIChat />} />
  ...
  {/* New mobile-only routes */}
  <Route path="/notifications" element={<NotificationsScreen />} />
  <Route path="/profile" element={<ProfileScreen />} />
</Route>
```

The key point: `MobileWebShell` internally renders `<Outlet />` in its content area. Child routes are composed by the router, not passed as JSX children. `MainDestopLayout` continues to work identically for desktop — it already owns an `<Outlet />` the same way.

**How `MobileWebShell` determines tab bar visibility:**

```typescript
// Inside MobileWebShell:
const location = useLocation()
const TAB_ROUTES = ["/", "/discover", "/notifications", "/profile"]
const isTabRoute = TAB_ROUTES.includes(location.pathname)
// Tab bar visible only on tab routes; hidden on /timeline/*, /ai, etc.
```

**Route-to-tab mapping:**

- `/` → Home tab active
- `/discover` → Discover tab active
- `/notifications` → Notifications tab active
- `/profile` → Profile tab active
- `/timeline/*`, `/ai`, `/action`, `/rsshub` → No tab active, tab bar hidden

### Reused Existing Components

- `SubscriptionColumnContainer` internals — re-housed in `MobileSubscriptionDrawer`
- Entry content renderer — same article/content view, rendered via `<Outlet />`
- `PresentSheet` — for secondary modals within mobile screens
- `useMobile()` hook — detection switch point
- `useNavigateEntry` — unchanged, pushes to `/timeline/*` routes which render inside the shell's `<Outlet />`

---

## 6. Desktop Corresponding Changes

### Must Change

**Route configuration** — Swap the layout route component based on `isMobile`:

- When `isMobile`, use `MobileWebShell` as the layout route instead of `MainDestopLayout`
- Both layout components render `<Outlet />` for child routes — same children, different shell
- `MainDestopLayout` is unchanged; it simply stops being used on mobile viewports
- Remove `MobileGlobalDrawerProvider` wrapper (no longer needed anywhere)

**Remove `MobileGlobalDrawerTrigger` from 3 files:**

- `modules/entry-column/layouts/EntryListHeader.tsx`
- `modules/app-layout/subview/SubviewLayout.tsx`
- `modules/public-timeline/entry-list.tsx`

**`MobileGlobalDrawer.tsx`** — Delete entirely:

- Its navigation is replaced by the tab bar
- Its user profile/settings are absorbed by the Profile tab
- Its feed list is absorbed by the subscription drawer
- The unauthenticated flow is handled by `MobileWebShell`'s per-tab conditional rendering

**`apps/desktop/tailwind.config.ts`** — Import shared brand colors:

- Add accent color tokens from `@follow/constants/colors`
- Map to CSS custom properties alongside existing UIKit tokens

### Minor Adjustments

- `player/corner-player.tsx` — On mobile, add `bottom: calc(50px + env(safe-area-inset-bottom))` so the mini player floats above the tab bar. The tab bar does not resize to accommodate it; the player overlays on top of feed content.
- `entry-column/layouts/*` — Card templates may need styling alignment with new card system
- `hooks/biz/useNavigateEntry.ts` — No changes needed; it already pushes to `/timeline/*` routes which render inside `MobileWebShell`'s `<Outlet />` as route replacements (not overlays)

### Unchanged

- Desktop layout, sidebar, all desktop-only UI
- Electron features (CmdF, CmdK, etc.)
- Desktop routing and `<Outlet />` behavior
- Existing UIKit color tokens for desktop
- All 28 other `useMobile()` consumers (they operate within content areas rendered by the new shell)

---

## 7. What We Are NOT Changing

- React Native mobile app (`apps/mobile`) — not in scope, but benefits from shared color tokens
- SSR app (`apps/ssr`)
- API (`apps/api`)
- Entry content rendering internals
- Desktop layout or behavior
- Authentication flow

---

## 8. Empty States

- **Home Feed (no subscriptions)**: Centered illustration + "Subscribe to your first feed" text + "Discover" button linking to Discover tab
- **Notifications (empty)**: Centered icon + "No notifications yet" text
- **Discover (no search results)**: "No feeds found" with suggestion to try different keywords
- **Subscription drawer (empty folder)**: Gray text "No feeds in this folder"

All empty states use the accent color for CTAs and `text-text-tertiary` for descriptions.
