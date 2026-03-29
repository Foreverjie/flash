# Mobile Web Account Drawer Design

**Date:** 2026-03-29
**Status:** Draft
**Scope:** Replace the mobile web subscription drawer with an account/settings drawer; move view-type filtering inline on the home feed.

## Problem

The current `MobileSubscriptionDrawer` has three issues:

1. **Non-functional** — feed items call `onNavigate` which only closes the drawer without navigating anywhere.
2. **Broken dark theme** — uses `bg-system-background` (a React Native UIKit token) instead of the desktop web color system.
3. **Redundant** — view-type tabs (Articles/Videos/Podcasts) belong closer to the feed, not buried in a drawer.

## Solution Overview

Two changes:

1. **Account drawer** — a compact drawer triggered by the user's avatar in the home header. Contains: user info, stats, navigation links, theme selector, sign out.
2. **Inline view filter chips** — horizontal pill bar on HomeFeedScreen that hides on scroll-down, reappears on scroll-up.

## Account Drawer

### Trigger

Replace the hamburger menu icon in `MobileHeader.tsx` (home route) with a 28px circular avatar:

- Image from `useWhoami().image`
- Fallback: first letter of `useWhoami().name` on a brand-colored circle
- `aria-label="Open account menu"`
- Sets `mobileDrawerOpenAtom` to `true` on tap

### Component: `MobileAccountDrawer.tsx`

Replaces `MobileSubscriptionDrawer.tsx`. Same animation mechanics (left slide-in, backdrop, spring transition with damping 25 / stiffness 300).

**Layout (top to bottom):**

| Section        | Content                                                                          | Data source                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User row       | 40px avatar, display name, email. Tap navigates to `/profile`.                   | `useWhoami()` from `@follow/store/user/hooks`                                                                                                           |
| Stats row      | "{N} subscriptions" and "{N} unread" side by side                                | `useFeedSubscriptionCount()` + `useListSubscriptionCount()` from `@follow/store/subscription/hooks`, `useUnreadAll()` from `@follow/store/unread/hooks` |
| Divider        | `border-border/50`                                                               | —                                                                                                                                                       |
| Nav links      | Bookmarks, Import OPML, Settings. Icon + label rows.                             | Navigate via `useNavigate()`                                                                                                                            |
| Divider        | `border-border/50`                                                               | —                                                                                                                                                       |
| Theme selector | Three-segment pill: sun icon / "System" / moon icon. Active segment highlighted. | `useThemeAtomValue()` from `@follow/hooks`, `useSetTheme()` from `~/hooks/common/useSyncTheme`                                                          |
| Divider        | `border-border/50`                                                               | —                                                                                                                                                       |
| Footer row     | "Sign out" left, "v{version}" right                                              | Sign out via auth API, version from `package.json`                                                                                                      |

### Color Tokens (all new/modified components)

| Purpose             | Token                 |
| ------------------- | --------------------- |
| Drawer background   | `bg-background`       |
| Primary text        | `text-text`           |
| Secondary text      | `text-text-secondary` |
| Tertiary text       | `text-text-tertiary`  |
| Active/pressed fill | `bg-fill-secondary`   |
| Subtle fill         | `bg-fill-tertiary`    |
| Dividers            | `border-border`       |

No raw colors. No `bg-system-background`.

## View Filter Chips

### Component: `ViewFilterBar` (inside `HomeFeedScreen.tsx`)

Horizontal scrollable row of pill-shaped chips rendered at the top of the home feed.

- Uses `useViewWithSubscription()` to only show views the user has subscriptions for
- Each chip: view icon + label + optional unread count badge
- Active chip: `bg-fill-secondary text-text`
- Inactive chip: `text-text-tertiary`

### Scroll-Direction-Aware Visibility

The filter bar hides when the user scrolls down and reappears when they scroll up:

- Track `scrollTop` on the feed scroll container via `onScroll`
- Compare current `scrollTop` with previous: delta > 0 (down) hides, delta < 0 (up) shows
- Threshold of ~5px to prevent jitter
- CSS `transform: translateY(-100%)` with a `transition` for smooth hide/show
- `position: sticky; top: 0` within the scroll container

### State

New Jotai atom in `atoms.ts`:

```typescript
export const mobileActiveViewAtom = atom(FeedViewType.Articles)
```

HomeFeedScreen reads this atom to filter entries by the selected view type.

## File Changes

| File                           | Action                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| `MobileSubscriptionDrawer.tsx` | Delete                                                           |
| `MobileAccountDrawer.tsx`      | Create (new)                                                     |
| `MobileHeader.tsx`             | Modify — avatar trigger replaces hamburger                       |
| `MobileWebShell.tsx`           | Modify — swap drawer import                                      |
| `HomeFeedScreen.tsx`           | Modify — add `ViewFilterBar`, wire up view filtering             |
| `atoms.ts`                     | Modify — add `mobileActiveViewAtom`, keep `mobileDrawerOpenAtom` |

No changes to: `MobileTabBar.tsx`, routing, `CornerPlayer`, or any other screens.

## Out of Scope

- Feed-level subscription browsing (can be added as a dedicated screen later)
- Profile screen redesign
- Notification preferences in the drawer
