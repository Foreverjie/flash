# Explore Page: Feed Posts & Post Detail Modals

**Date:** 2026-03-23
**Status:** Approved
**Scope:** Desktop web only (explore module)

## Summary

Add two stacked modals to the Explore page so users can preview a feed's posts without leaving the page. Clicking a feed card opens a **Feed Posts Modal** (post list with feed header). Clicking a post opens a **Post Detail Modal** stacked on top (reuses existing `PostDetailContent`). Both use the existing `useModalStack()` infrastructure.

## Interaction Flow

```
Explore Page (feed cards)
  │ click feed card body
  ▼
Feed Posts Modal (layer 1)
  │ click post item
  ▼
Post Detail Modal (layer 2, stacks on top)
```

- **Dismiss:** Click outside or press Esc closes the top modal only.
- Close Post Detail → returns to Feed Posts Modal.
- Close Feed Posts Modal → returns to Explore page.
- Scroll position in Feed Posts Modal is preserved when Post Detail opens/closes (modal stack keeps layer 1 mounted).

## Components

### New (all in `apps/desktop/layer/renderer/src/modules/explore/`)

#### 1. `FeedPostsModal`

Opened via `useModalStack().present()` when a feed card is clicked.

**Layout:**

- **Feed header:** feed icon, title, site URL, subscriber count, follow/unfollow button
- **Scrollable post list:** `FeedPostItem` cards
- **Pagination:** "Load more" button at bottom

**Props:**

```typescript
interface FeedPostsModalProps {
  feed: FeedItem // from usePublicFeedsQuery()
}
```

**Data & Pagination:** The modal maintains a `useState<PostItem[]>` accumulator for loaded posts and a `page` counter. Each "Load more" click fetches the next page via `usePostsQuery(page, limit, feedId)` (which calls `GET /api/v1/posts?feedId=X&page=N&limit=20`) and appends the new items to the accumulator. The initial page loads on mount. The "Load more" button is hidden when `hasMore` is false.

```typescript
// Pagination state inside FeedPostsModal
const [allPosts, setAllPosts] = useState<PostItem[]>([])
const [page, setPage] = useState(1)
const { data, isLoading } = usePostsQuery(page, 20, feed.id)

// Append new page results to accumulator
useEffect(() => {
  if (data?.data) {
    setAllPosts((prev) => {
      const existingIds = new Set(prev.map((p) => p.id))
      const newPosts = data.data.filter((p) => !existingIds.has(p.id))
      return [...prev, ...newPosts]
    })
  }
}, [data])
```

**Follow button & subscription state:** The modal uses the same TanStack Query hooks as the Explore feed list (`useUserSubscriptionsQuery`, `useSubscribeFeedMutation`, `useUnsubscribeFeedMutation` from `~/queries/feeds`). Both the modal and the underlying feed cards read from the same `["user", "subscriptions"]` query cache. Both mutation hooks call `queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] })` on success, so subscribing/unsubscribing in the modal automatically updates the feed card beneath it (and vice versa).

**Sidebar/timeline consistency (Zustand store):** The sidebar and timeline rely on the Zustand subscription store (populated by `subscriptionSyncService.fetch()` via `usePrefetchSubscription()` in `SubscriptionColumn`). The Explore page mutation hooks only invalidate the TanStack Query cache — they do **not** sync the Zustand store. This means:

- **When `SubscriptionColumn` is mounted** (normal authenticated layout): the sidebar already re-renders from its own `usePrefetchSubscription()` query on a 30-minute stale cycle, so it will eventually catch up. For immediate sync, the mutation hooks also invalidate the `["subscription"]` query key prefix, which matches all `["subscription", view]` keys (TanStack Query uses prefix matching by default, `exact: false`). This triggers the column's `usePrefetchSubscription()` to refetch and rebuild the Zustand store.
- **When `SubscriptionColumn` is not mounted** (public mode, sidebar hidden): the Zustand store stays empty/stale. This is acceptable because there is no sidebar visible to show inconsistent state. When the column eventually mounts, `usePrefetchSubscription()` runs a fresh fetch and hydrates the store with correct data.

```typescript
// In mutation onSuccess callbacks:
queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] }) // Explore page
queryClient.invalidateQueries({ queryKey: ["subscription"] }) // sidebar (if mounted)
// Note: TanStack Query's invalidateQueries uses prefix matching by default
// (exact: false). ["subscription"] matches all ["subscription", view] keys
// created by usePrefetchSubscription(view?) in SubscriptionColumn.
```

**Why not call `subscriptionSyncService.subscribe()`/`.unsubscribe()` directly?**

- `subscriptionSyncService.subscribe()` makes its own API call via `api().subscriptions.create()`, which would duplicate the `POST /subscriptions` the mutation hook already made.
- `subscriptionSyncService.unsubscribe(feedId)` looks up `get().data[feedId]` in the Zustand store and returns early if not found. When the store is empty (before `SubscriptionColumn` mounts), every unsubscribe silently no-ops.
- Calling store internals directly (e.g. `subscriptionActions.upsertMany()`) would require the fully denormalized `SubscriptionModel` with feed/list metadata that the `/api/v1/subscriptions` POST endpoint doesn't return — it only returns `{ subscription, existed }` with minimal fields.

**Auth guard:** The modal checks `useWhoami()` before rendering subscription controls. Unauthenticated users see no follow button (or a disabled one with toast on click).

**Component structure:** The modal renders `<FeedPostsModalBody>` for anonymous users (no subscription hooks) or `<AuthenticatedFeedPostsModalBody>` for authenticated users. This avoids conditional hook calls.

```tsx
// FeedPostsModal renders one of two components based on auth
function FeedPostsModal({ feed }: FeedPostsModalProps) {
  const user = useWhoami()
  return user ? (
    <AuthenticatedFeedPostsModalBody feed={feed} />
  ) : (
    <FeedPostsModalBody feed={feed} followButton={null} />
  )
}

// Only rendered for authenticated users — hooks called unconditionally.
// Still pass !!user to useUserSubscriptionsQuery as a safety guard:
// useWhoami() reads from an async session query and can briefly return
// null during resolution, so the enabled flag prevents 401s in that window.
function AuthenticatedFeedPostsModalBody({ feed }: { feed: FeedItem }) {
  const user = useWhoami()
  const { data: subscriptions } = useUserSubscriptionsQuery(!!user)
  const subscribedFeedIds = useMemo(
    () => new Set(subscriptions?.map((s) => s.feedId) ?? []),
    [subscriptions],
  )
  const isSubscribed = subscribedFeedIds.has(feed.id)

  const subscribeMutation = useSubscribeFeedMutation()
  const unsubscribeMutation = useUnsubscribeFeedMutation()

  const handleToggleSubscribe = useCallback(() => {
    if (isSubscribed) {
      unsubscribeMutation.mutate(feed.id)
    } else {
      subscribeMutation.mutate(feed.id)
    }
  }, [isSubscribed, feed.id, subscribeMutation, unsubscribeMutation])

  return (
    <FeedPostsModalBody
      feed={feed}
      followButton={<FollowButton isSubscribed={isSubscribed} onToggle={handleToggleSubscribe} />}
    />
  )
}
```

**View selection:** For MVP, defaults to `FeedViewType.Articles`. This matches auto-subscribe behavior elsewhere. Users can change the view via subscription edit (Edit in sidebar). A view picker can be added later if the explore page expands to filter by content type.

**Modal config:**

```typescript
present({
  title: feed.title || "Feed Posts",
  content: () => <FeedPostsModal feed={feed} />,
  clickOutsideToDismiss: true,
  modalClassName: "relative mx-auto mt-[10vh] max-h-[80vh] max-w-2xl overflow-hidden",
})
```

**Dismiss:** Uses `useCurrentModal()` hook inside the component to access `dismiss` if programmatic close is needed.

#### 2. `FeedPostItem`

Individual post card within the Feed Posts Modal.

**Layout:** Row with:

- Left: title (bold), description snippet (2 lines, stripped HTML), author + relative time
- Right: thumbnail image (60x60, if `post.media[0]` exists)

**Props:**

```typescript
interface FeedPostItemProps {
  post: PostItem // from usePostsQuery()
  onSelect: (post: PostItem) => void
}
```

**Interaction:** Click calls `onSelect` which triggers parent to open Post Detail Modal.

### Reused (existing, no changes needed)

#### `PostDetailContent` (from `~/modules/public-timeline/post-detail.tsx`)

Already implements the exact post detail rendering we need:

- Fetches full post via `usePostDetailQuery(postId)` — gets `formattedContent.html` (richer than list data)
- Content priority: `formattedContent.html` → `post.content` → `post.description`
- Sticky header with feed icon, title, author, date
- "Open original" external link button
- Close button (accepts `onClose` prop)
- Image gallery from `post.media`
- Category tags
- Loading skeleton
- Empty/error states
- Scrollable article body with `ScrollArea`

**Post Detail Modal config:**

```typescript
// Wrapper needed because PostDetailContent.onClose must dismiss the
// Post Detail Modal (layer 2), not the Feed Posts Modal (layer 1).
// useCurrentModal() inside the wrapper resolves to the correct layer.
function PostDetailModalContent({ postId }: { postId: string }) {
  const { dismiss } = useCurrentModal()
  return <PostDetailContent postId={postId} onClose={dismiss} />
}

present({
  title: post.title || "Post",
  content: () => <PostDetailModalContent postId={post.id} />,
  clickOutsideToDismiss: true,
  modalClassName: "relative mx-auto mt-[10vh] max-h-[80vh] max-w-3xl overflow-hidden",
})
```

Note: `PostDetailContent` uses `usePostDetailQuery(postId)` internally which fetches from `GET /api/v1/posts/:id`. This returns richer data including `formattedContent` with HTML/markdown/text variants. The `PostDetailModalContent` wrapper ensures `useCurrentModal()` resolves to the Post Detail Modal's context, not the parent's.

### Modified

#### `FeedCard` (existing in `feed-list.tsx`)

Current state: The inner feed info div (`className="min-w-0 flex-1"`) has `onClick={handleOpenSite}` which opens the feed's site URL in a new tab. The subscribe button is in a sibling div, outside the clickable area.

Changes needed:

- Move the click handler to the **outer card div** so the entire card is clickable, and change it to `handleOpenPosts` that opens `FeedPostsModal`
- Move the site URL link to a small external-link icon button next to the subscribe button
- Add `e.stopPropagation()` on both the subscribe button and the site link icon button to prevent card click from firing
- `FeedCard` needs access to `useModalStack()` — the Explore page renders within the `ModalStackProvider` (it wraps the entire app at root level)

### Other Reused (no changes)

- `useModalStack()` — stacked modal infrastructure
- `useCurrentModal()` — access dismiss function inside modal content
- `usePostsQuery(page, limit, feedId)` — TanStack Query hook for `GET /api/v1/posts?feedId=X`
- `usePostDetailQuery(postId)` — TanStack Query hook for `GET /api/v1/posts/:id`
- `usePublicFeedsQuery()` — feed list query
- `useUserSubscriptionsQuery(enabled)` — TanStack Query hook for `GET /api/v1/subscriptions`, returns user's subscribed feed IDs. Must be gated by auth (`enabled: !!user`) to avoid 401s for anonymous visitors
- `useSubscribeFeedMutation()` / `useUnsubscribeFeedMutation()` — TanStack Query mutations that invalidate both `["user", "subscriptions"]` (Explore page) and `["subscription"]` (Zustand store via `usePrefetchSubscription`) on success
- `useWhoami()` — from `@follow/store/user/hooks`, auth guard for follow button

## Data Flow

```
FeedCard.onClick(feed)
  → useModalStack().present(<FeedPostsModal feed={feed} />)
    → usePostsQuery(page, 20, feed.id)  // page starts at 1
      → GET /api/v1/posts?feedId={feed.id}&page=N&limit=20
    → appends results to useState<PostItem[]> accumulator
    → renders FeedPostItem[] from accumulated posts
    → "Load more" increments page → fetches next page → appends
    → useUserSubscriptionsQuery(!!user) reads subscription state from TanStack Query cache
    → Follow/Unfollow → useSubscribeFeedMutation / useUnsubscribeFeedMutation
      → POST/DELETE /api/v1/subscriptions
      → onSuccess: invalidates ["user", "subscriptions"] query cache (syncs modal + feed cards)
      → onSuccess: invalidates ["subscription"] query cache (syncs sidebar if SubscriptionColumn mounted)
    → FeedPostItem.onClick(post)
      → useModalStack().present(<PostDetailModalContent postId={post.id} />)
        → usePostDetailQuery(post.id)
          → GET /api/v1/posts/{post.id}
        → renders formattedContent.html → content → description (priority chain)
        → "Open original" → window.open(post.url)
```

Post data flows through TanStack Query. Subscription mutations invalidate two query keys: `["user", "subscriptions"]` (keeps the modal and feed list in sync via shared cache) and `["subscription"]` (triggers `usePrefetchSubscription` refetch in `SubscriptionColumn`, which calls `subscriptionSyncService.fetch()` to rebuild the Zustand store with full feed/list/unread data for the sidebar/timeline).

## API Endpoints Used

| Endpoint                                     | Purpose                   | Auth |
| -------------------------------------------- | ------------------------- | ---- |
| `GET /api/v1/posts?feedId=X&page=1&limit=20` | Fetch posts for feed      | No   |
| `GET /api/v1/posts/:id`                      | Fetch full post detail    | No   |
| `POST /subscriptions`                        | Follow feed               | Yes  |
| `DELETE /subscriptions`                      | Unfollow feed             | Yes  |
| `GET /subscriptions`                         | Check subscription status | Yes  |

All endpoints already exist — no API changes needed.

## Styling

- Follows existing Tailwind + Apple UIKit color tokens (`bg-fill-quaternary`, `text-text-secondary`, etc.)
- Feed header matches the existing `FeedCard` style
- Post items use `hover:bg-fill-tertiary` for hover states
- Post detail inherits styling from `PostDetailContent` (prose classes, ScrollArea, etc.)
- Modal widths: Feed Posts = `max-w-2xl` (~672px), Post Detail = `max-w-3xl` (~768px)
- Modal height: `max-h-[80vh]` with internal scroll to prevent overflow

## Dependencies

No new dependencies required. `PostDetailContent` uses `dangerouslySetInnerHTML` directly, matching the existing codebase pattern.

## Edge Cases

- **Empty feed:** Show "No posts yet" empty state with icon in Feed Posts Modal
- **No content:** Handled by `PostDetailContent` — shows "No content available" with link to original
- **Loading state:** Skeleton loading for post list while `usePostsQuery` is fetching; `PostDetailContent` has its own `DetailSkeleton`
- **Error state:** Show error message with retry button if posts fetch fails
- **Unauthenticated follow:** Show follow button but toast "Please login to subscribe" on click (existing behavior from FeedCard)
- **Media:** Display first image from `post.media` as thumbnail in list; `PostDetailContent` shows full image gallery
- **Click propagation:** Subscribe button in FeedCard uses `e.stopPropagation()` to avoid triggering card click
- **Scroll preservation:** Feed Posts Modal scroll position preserved when Post Detail opens (layer stays mounted)

## i18n

New UI strings need keys added to locale files (`en`, `zh-CN`, `ja`). Keys needed:

- `explore.no_posts` — "No posts yet"
- `explore.load_more` — "Load more"
- `explore.subscribers_count` — "{count} subscribers"
- `explore.open_site` — "Open site"

## Out of Scope

- Mobile app changes (mobile has no explore page currently)
- Entry store hydration
- Readability mode toggle
- AI summary in post detail
- Keyboard navigation between posts
