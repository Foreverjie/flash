# Explore Feed Posts & Post Detail Modals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add stacked modals to the Explore page so users can preview a feed's posts and read individual post details without leaving the page.

**Architecture:** Clicking a feed card opens a Feed Posts Modal (layer 1) showing the feed header + paginated post list. Clicking a post opens a Post Detail Modal (layer 2) that reuses the existing `PostDetailContent` component. Both use the existing `useModalStack()` infrastructure. Subscription state flows through TanStack Query (`["user", "subscriptions"]` cache) shared between the modal and feed list, with sidebar sync via `["subscription"]` query invalidation.

**Tech Stack:** React 19, TanStack Query v5, Tailwind CSS with Apple UIKit tokens, i18next, existing modal stack from `~/components/ui/modal/stacked/`

**Spec:** `docs/superpowers/specs/2026-03-23-explore-feed-post-modals-design.md`

---

## File Map

| Action | File                                                                   | Responsibility                                                                      |
| ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Create | `apps/desktop/layer/renderer/src/modules/explore/feed-posts-modal.tsx` | FeedPostsModal (auth split + body), FeedPostItem, PostDetailModalContent wrapper    |
| Modify | `apps/desktop/layer/renderer/src/modules/explore/feed-list.tsx`        | FeedCard: card-level click → open modal, external link icon button, stopPropagation |
| Modify | `apps/desktop/layer/renderer/src/queries/feeds.ts`                     | Add `["subscription"]` invalidation to mutation onSuccess callbacks                 |

---

## Task 1: Enhance mutation hooks to sync sidebar

The subscribe/unsubscribe mutation hooks currently only invalidate `["user", "subscriptions"]`. They must also invalidate `["subscription"]` so `usePrefetchSubscription()` in SubscriptionColumn refetches and rebuilds the Zustand store.

**Files:**

- Modify: `apps/desktop/layer/renderer/src/queries/feeds.ts:85-124`

- [ ] **Step 1: Add `["subscription"]` invalidation to useSubscribeFeedMutation**

In `apps/desktop/layer/renderer/src/queries/feeds.ts`, find `useSubscribeFeedMutation` (line 85). Its `onSuccess` callback (line 98) currently only invalidates `["user", "subscriptions"]`. Add the second invalidation:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] })
  // Sync sidebar Zustand store (if SubscriptionColumn is mounted).
  // TanStack Query uses prefix matching by default (exact: false),
  // so this matches all ["subscription", view] keys.
  queryClient.invalidateQueries({ queryKey: ["subscription"] })
},
```

- [ ] **Step 2: Add `["subscription"]` invalidation to useUnsubscribeFeedMutation**

Same change in `useUnsubscribeFeedMutation` (line 107), its `onSuccess` at line 120:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["user", "subscriptions"] })
  queryClient.invalidateQueries({ queryKey: ["subscription"] })
},
```

- [ ] **Step 3: Verify the app builds**

Run: `cd apps/desktop && pnpm run typecheck`
Expected: No errors related to feeds.ts

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/layer/renderer/src/queries/feeds.ts
git commit -m "feat(explore): sync sidebar store on subscribe/unsubscribe mutations"
```

---

## Task 2: Create FeedPostItem component

A row component for individual posts inside the Feed Posts Modal.

**Files:**

- Create: `apps/desktop/layer/renderer/src/modules/explore/feed-posts-modal.tsx`

- [ ] **Step 1: Create the file with FeedPostItem**

Create `apps/desktop/layer/renderer/src/modules/explore/feed-posts-modal.tsx` with the `FeedPostItem` component. This is the building block used by the modal body.

```tsx
import { cn } from "@follow/utils/utils"
import { memo } from "react"

import type { PostItem } from "~/queries/posts"

interface FeedPostItemProps {
  post: PostItem
  onSelect: (post: PostItem) => void
}

export const FeedPostItem = memo(({ post, onSelect }: FeedPostItemProps) => {
  const thumbnail = post.media?.find((m) => m.type === "image")

  return (
    <div
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg p-3",
        "transition-colors duration-150",
        "hover:bg-fill-tertiary",
      )}
      onClick={() => onSelect(post)}
    >
      <div className="min-w-0 flex-1">
        <h4 className="text-text line-clamp-1 text-sm font-semibold">{post.title || "Untitled"}</h4>
        {post.description && (
          <p className="text-text-tertiary mt-0.5 line-clamp-2 text-xs leading-relaxed">
            {post.description.replace(/<[^>]*>/g, "")}
          </p>
        )}
        <div className="text-text-quaternary mt-1.5 flex items-center gap-2 text-[10px]">
          {post.author && <span className="truncate">{post.author}</span>}
          {post.author && post.publishedAt && <span>·</span>}
          {post.publishedAt && <time>{new Date(post.publishedAt).toLocaleDateString()}</time>}
        </div>
      </div>
      {thumbnail && (
        <img
          src={thumbnail.url}
          alt=""
          className="size-[60px] shrink-0 rounded-md object-cover"
          loading="lazy"
        />
      )}
    </div>
  )
})
```

- [ ] **Step 2: Verify the app builds**

Run: `cd apps/desktop && pnpm run typecheck`
Expected: No errors (file imports from existing modules only)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/explore/feed-posts-modal.tsx
git commit -m "feat(explore): add FeedPostItem component"
```

---

## Task 3: Create FeedPostsModal with auth split

The main modal component with feed header, scrollable post list, pagination, and follow/unfollow button. Uses component split to avoid conditional hook calls.

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/explore/feed-posts-modal.tsx`

- [ ] **Step 1: Add imports**

Add the following imports to the top of `feed-posts-modal.tsx`:

```tsx
import { Button } from "@follow/components/ui/button/index.js"
import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import type { ReactNode } from "react"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { useCurrentModal, useModalStack } from "~/components/ui/modal/stacked/hooks"
import type { FeedItem } from "~/queries/feeds"
import {
  useSubscribeFeedMutation,
  useUnsubscribeFeedMutation,
  useUserSubscriptionsQuery,
} from "~/queries/feeds"
import type { PostItem } from "~/queries/posts"
import { usePostsQuery } from "~/queries/posts"
import { PostDetailContent } from "~/modules/public-timeline/post-detail"
```

Note: Verify the exact import path for `PostDetailContent`. It's exported from `apps/desktop/layer/renderer/src/modules/public-timeline/post-detail.tsx`. Check if it's a named or default export — from the exploration, it's a function declaration so should be a named export. Verify with: `grep "export.*PostDetailContent" apps/desktop/layer/renderer/src/modules/public-timeline/post-detail.tsx`.

- [ ] **Step 2: Add PostDetailModalContent wrapper**

This wrapper exists so `useCurrentModal()` resolves to the Post Detail Modal's context (layer 2), not the parent Feed Posts Modal (layer 1).

```tsx
function PostDetailModalContent({ postId }: { postId: string }) {
  const { dismiss } = useCurrentModal()
  return <PostDetailContent postId={postId} onClose={dismiss} />
}
```

- [ ] **Step 3: Add FeedPostsModalBody (shared body, no auth hooks)**

This is the pure rendering component used by both anonymous and authenticated paths.

```tsx
function FeedPostsModalBody({
  feed,
  followButton,
}: {
  feed: FeedItem
  followButton: ReactNode
}) {
  const { t } = useTranslation()
  const { present } = useModalStack()

  const [allPosts, setAllPosts] = useState<PostItem[]>([])
  const [page, setPage] = useState(1)
  const { data, isLoading } = usePostsQuery(page, 20, feed.id)

  // Append new page results to accumulator (dedup by id)
  useEffect(() => {
    if (data?.data) {
      setAllPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id))
        const newPosts = data.data.filter((p: PostItem) => !existingIds.has(p.id))
        return [...prev, ...newPosts]
      })
    }
  }, [data])

  const handleSelectPost = useCallback(
    (post: PostItem) => {
      present({
        title: post.title || "Post",
        content: () => <PostDetailModalContent postId={post.id} />,
        clickOutsideToDismiss: true,
        modalClassName:
          "relative mx-auto mt-[10vh] max-h-[80vh] max-w-3xl overflow-hidden",
      })
    },
    [present],
  )

  const hasMore = data?.hasMore ?? true

  return (
    <div className="flex max-h-[80vh] flex-col">
      {/* Feed header */}
      <div className="flex items-center gap-3 border-b border-border p-4">
        <div className="shrink-0">
          {feed.image ? (
            <img
              src={feed.image}
              alt=""
              className="size-11 rounded-lg object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-11 items-center justify-center rounded-lg bg-fill-tertiary">
              <i className="i-mgc-rss-cute-fi text-lg text-text-quaternary" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-text">
            {feed.title || feed.url}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-text-quaternary">
            {feed.siteUrl && <span>{new URL(feed.siteUrl).hostname}</span>}
            {feed.subscriptionCount != null && (
              <span>
                {t("explore.subscribers_count", {
                  defaultValue: "{{count}} subscribers",
                  count: feed.subscriptionCount,
                })}
              </span>
            )}
          </div>
        </div>
        {followButton}
      </div>

      {/* Scrollable post list */}
      <ScrollArea.ScrollArea rootClassName="h-0 grow" viewportClassName="p-2">
          {allPosts.length === 0 && isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[72px] w-full rounded-lg" />
              ))}
            </div>
          ) : allPosts.length === 0 && !isLoading && data ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-tertiary">
              <i className="i-mgc-document-cute-re text-3xl" />
              <p className="mt-3 text-sm">
                {t("explore.no_posts", { defaultValue: "No posts yet" })}
              </p>
            </div>
          ) : (
            <>
              {allPosts.map((post) => (
                <FeedPostItem
                  key={post.id}
                  post={post}
                  onSelect={handleSelectPost}
                />
              ))}
              {hasMore && (
                <div className="py-3 text-center">
                  <Button
                    variant="ghost"
                    buttonClassName="text-xs"
                    disabled={isLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    {isLoading ? (
                      <i className="i-mgc-loading-3-cute-re animate-spin" />
                    ) : (
                      t("explore.load_more", { defaultValue: "Load more" })
                    )}
                  </Button>
                </div>
              )}
            </>
          )
      </ScrollArea.ScrollArea>
    </div>
  )
}
```

- [ ] **Step 4: Add AuthenticatedFeedPostsModalBody**

This component is only rendered for authenticated users, so all subscription hooks are called unconditionally (no React rules violation).

```tsx
function AuthenticatedFeedPostsModalBody({ feed }: { feed: FeedItem }) {
  const { t } = useTranslation()
  const user = useWhoami()
  const { data: subscriptions } = useUserSubscriptionsQuery(!!user)
  const subscribedFeedIds = useMemo(
    () => new Set(subscriptions?.map((s) => s.feedId) ?? []),
    [subscriptions],
  )
  const isSubscribed = subscribedFeedIds.has(feed.id)

  const subscribeMutation = useSubscribeFeedMutation()
  const unsubscribeMutation = useUnsubscribeFeedMutation()
  const isPending = subscribeMutation.isPending || unsubscribeMutation.isPending

  const handleToggleSubscribe = useCallback(() => {
    if (isSubscribed) {
      unsubscribeMutation.mutate(feed.id, {
        onSuccess: () => {
          toast.success(t("explore.unsubscribed", { defaultValue: "Unsubscribed" }))
        },
        onError: () => {
          toast.error(t("explore.unsubscribe_failed", { defaultValue: "Failed to unsubscribe" }))
        },
      })
    } else {
      subscribeMutation.mutate(feed.id, {
        onSuccess: () => {
          toast.success(t("explore.subscribed", { defaultValue: "Subscribed!" }))
        },
        onError: () => {
          toast.error(t("explore.subscribe_failed", { defaultValue: "Failed to subscribe" }))
        },
      })
    }
  }, [isSubscribed, feed.id, subscribeMutation, unsubscribeMutation, t])

  const followButton = (
    <Button
      variant={isSubscribed ? "outline" : "primary"}
      buttonClassName="text-xs"
      disabled={isPending}
      onClick={handleToggleSubscribe}
    >
      {isPending ? (
        <i className="i-mgc-loading-3-cute-re animate-spin" />
      ) : isSubscribed ? (
        t("explore.following", { defaultValue: "Following" })
      ) : (
        t("explore.follow", { defaultValue: "Follow" })
      )}
    </Button>
  )

  return <FeedPostsModalBody feed={feed} followButton={followButton} />
}
```

- [ ] **Step 5: Add FeedPostsModal entry component (auth split)**

```tsx
export function FeedPostsModal({ feed }: { feed: FeedItem }) {
  const user = useWhoami()
  return user ? (
    <AuthenticatedFeedPostsModalBody feed={feed} />
  ) : (
    <FeedPostsModalBody feed={feed} followButton={null} />
  )
}
```

- [ ] **Step 6: Verify the app builds**

Run: `cd apps/desktop && pnpm run typecheck`

Common issues to check:

- `PostDetailContent` export: verify it's a named export with `grep "export.*function PostDetailContent\|export.*const PostDetailContent" apps/desktop/layer/renderer/src/modules/public-timeline/post-detail.tsx`. If it's not exported, add `export` to the function declaration.
- `ScrollArea` usage: check how `post-detail.tsx` uses it and match the pattern.
- `usePostsQuery` return shape: verify `data.data` is the posts array and `data.hasMore` exists by checking `PostsResponse` type in `queries/posts.ts`.
- `toast` import: ensure `sonner` is imported.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/explore/feed-posts-modal.tsx
git commit -m "feat(explore): add FeedPostsModal with auth split and pagination"
```

---

## Task 4: Modify FeedCard to open Feed Posts Modal

Change the FeedCard click target from opening the site URL to opening the Feed Posts Modal. Move the site link to a small icon button.

**Files:**

- Modify: `apps/desktop/layer/renderer/src/modules/explore/feed-list.tsx:66-173`

- [ ] **Step 1: Add modal import to feed-list.tsx**

Add to the imports section at the top of `feed-list.tsx`:

```tsx
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { FeedPostsModal } from "./feed-posts-modal"
```

- [ ] **Step 2: Replace handleOpenSite with handleOpenPosts inside FeedCard**

Inside the `FeedCard` component (line 66), replace the `handleOpenSite` handler (lines 108-113) with:

```tsx
const { present } = useModalStack()

const handleOpenPosts = useCallback(() => {
  present({
    title: feed.title || "Feed Posts",
    content: () => <FeedPostsModal feed={feed} />,
    clickOutsideToDismiss: true,
    modalClassName: "relative mx-auto mt-[10vh] max-h-[80vh] max-w-2xl overflow-hidden",
  })
}, [present, feed])

const handleOpenSite = useCallback(
  (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = feed.siteUrl || feed.url
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer")
    }
  },
  [feed.siteUrl, feed.url],
)
```

Note: `handleOpenSite` now takes an event and calls `e.stopPropagation()` since the whole card will be clickable.

- [ ] **Step 3: Move onClick to outer card div and add stopPropagation to subscribe button**

Change the outer card `<div>` (line 116) to add the click handler and cursor:

```tsx
<div
  className={cn(
    "group relative flex cursor-pointer items-start gap-4 rounded-xl p-4",
    "bg-fill-quaternary transition-colors duration-150",
    "hover:bg-fill-tertiary",
  )}
  onClick={handleOpenPosts}
>
```

Remove `cursor-pointer` and `onClick={handleOpenSite}` from the inner feed info div (line 140). Change it to:

```tsx
<div className="min-w-0 flex-1">
```

- [ ] **Step 4: Add external link icon button and stopPropagation on subscribe button**

Replace the subscribe button section (lines 153-169) with both an external link icon and the subscribe button, both with `e.stopPropagation()`:

```tsx
{
  /* Actions */
}
;<div className="flex shrink-0 items-center gap-2">
  {(feed.siteUrl || feed.url) && (
    <button
      type="button"
      className="text-text-tertiary hover:bg-fill-tertiary hover:text-text-secondary flex size-8 items-center justify-center rounded-lg transition-colors"
      onClick={handleOpenSite}
      title={t("explore.open_site", { defaultValue: "Open site" })}
    >
      <i className="i-mgc-external-link-cute-re text-sm" />
    </button>
  )}
  <Button
    variant={isSubscribed ? "outline" : "primary"}
    buttonClassName="text-xs"
    disabled={isPending}
    onClick={(e) => {
      e.stopPropagation()
      handleToggleSubscribe()
    }}
  >
    {isPending ? (
      <i className="i-mgc-loading-3-cute-re animate-spin" />
    ) : isSubscribed ? (
      t("explore.following", { defaultValue: "Following" })
    ) : (
      t("explore.follow", { defaultValue: "Follow" })
    )}
  </Button>
</div>
```

- [ ] **Step 5: Verify the app builds**

Run: `cd apps/desktop && pnpm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/layer/renderer/src/modules/explore/feed-list.tsx
git commit -m "feat(explore): FeedCard opens feed posts modal on click"
```

---

## Task 5: Verify PostDetailContent is exported

`PostDetailContent` is already an `export function` at `post-detail.tsx:64`. No changes expected, but verify during Task 3 Step 6 typecheck. If the import fails, add `export` to the function declaration.

---

## Task 6: Manual smoke test

No automated UI tests exist for the explore module. Verify the feature works correctly by running the dev server.

- [ ] **Step 1: Start the dev server**

Run: `cd apps/desktop && pnpm run dev:web`

- [ ] **Step 2: Test Feed Posts Modal**

1. Navigate to the Explore page
2. Click a feed card body → Feed Posts Modal should open
3. Verify: feed header shows icon, title, hostname, subscriber count
4. Verify: post list loads with title, description snippet, author, date, thumbnail
5. Click "Load more" → more posts should append (scroll position preserved)
6. Click outside the modal → modal should close

- [ ] **Step 3: Test Post Detail Modal (stacked)**

1. Open a Feed Posts Modal
2. Click a post item → Post Detail Modal should stack on top
3. Verify: article content renders (title, author, date, HTML body, images)
4. Verify: "Open original" link works
5. Click close or press Esc → Post Detail closes, Feed Posts Modal is still visible
6. Verify: scroll position in Feed Posts Modal is preserved

- [ ] **Step 4: Test subscribe/unsubscribe**

1. Sign in (if not already)
2. Open Feed Posts Modal for an unsubscribed feed
3. Click "Follow" → should show "Following", toast confirms
4. Close modal → feed card underneath should also show "Following" (shared query cache)
5. Re-open modal → click "Following" → should revert to "Follow"
6. Verify: sidebar updates if SubscriptionColumn is visible

- [ ] **Step 5: Test edge cases**

1. Click external link icon on feed card → should open site in new tab (not trigger modal)
2. Click subscribe button on feed card → should subscribe (not trigger modal)
3. Open Feed Posts Modal while not signed in → no follow button visible
4. Open a feed with no posts → "No posts yet" empty state
5. Test Esc key → closes top modal only

- [ ] **Step 6: Run quality gates**

```bash
pnpm run typecheck && pnpm run lint:fix
```

- [ ] **Step 7: Final commit (lint fixes if any)**

```bash
git add -u
git commit -m "chore(explore): lint fixes for feed post modals"
```
