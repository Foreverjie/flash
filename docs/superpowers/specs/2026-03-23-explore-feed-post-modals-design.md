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

**Data:** Uses existing `usePostsQuery(page, limit, feedId)` from `~/queries/posts`. This calls `GET /api/v1/posts?feedId=X&page=1&limit=20`. Pagination via "Load more" accumulating pages in local state.

**Follow button:** Uses `useSubscribeFeedMutation()` / `useUnsubscribeFeedMutation()` from `~/queries/feeds`. Shows "Follow" or "Following" based on `useUserSubscriptionsQuery()`.

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
- `useSubscribeFeedMutation()` / `useUnsubscribeFeedMutation()` — follow/unfollow
- `useUserSubscriptionsQuery()` — check subscription status

## Data Flow

```
FeedCard.onClick(feed)
  → useModalStack().present(<FeedPostsModal feed={feed} />)
    → usePostsQuery(1, 20, feed.id)
      → GET /api/v1/posts?feedId={feed.id}&page=1&limit=20
    → renders FeedPostItem[] from query cache
    → FeedPostItem.onClick(post)
      → useModalStack().present(<PostDetailContent postId={post.id} />)
        → usePostDetailQuery(post.id)
          → GET /api/v1/posts/{post.id}
        → renders formattedContent.html → content → description (priority chain)
        → "Open original" → window.open(post.url)
```

No entry store involvement. All data flows through TanStack Query, scoped to the explore module.

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
- `useInfiniteQuery` for pagination (can be optimized later)
