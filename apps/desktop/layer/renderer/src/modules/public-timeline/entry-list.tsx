import { ActionButton } from "@follow/components/ui/button/index.js"
import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { cn } from "@follow/utils/utils"
import { useCallback, useRef } from "react"

import type { PostItem } from "~/queries/posts"
import { usePostsQuery } from "~/queries/posts"

import { PublicEntryItem } from "./entry-item"

const LIMIT = 30

/**
 * Middle column: scrollable entry list fetching posts from public API.
 * Now supports active post selection and thread line visual.
 */
export function PublicEntryList({
  selectedFeedId,
  selectedFeedTitle,
  page,
  setPage,
  activePostId,
  onSelectPost,
}: {
  selectedFeedId: string | null
  selectedFeedTitle: string | null
  page: number
  setPage: (page: number) => void
  activePostId: string | null
  onSelectPost: (postId: string) => void
}) {
  const { data, isLoading, isFetching } = usePostsQuery(page, LIMIT, selectedFeedId ?? undefined)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleRefresh = useCallback(() => {
    setPage(1)
  }, [setPage])

  return (
    <div className="relative flex h-full flex-1 flex-col">
      {/* Header */}
      <div className="flex w-full items-center px-5 pb-2 pt-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <i className="i-mgc-rada-cute-re text-lg" />
          <span className="truncate text-lg font-bold">{selectedFeedTitle || "All Posts"}</span>
          {data && <span className="ml-1 shrink-0 text-xs text-text-tertiary">{data.total}</span>}
        </div>
        <div className="flex items-center gap-2">
          <ActionButton tooltip="Refresh" onClick={handleRefresh} disabled={isFetching}>
            <i className={cn("i-mgc-refresh-2-cute-re", isFetching && "animate-spin")} />
          </ActionButton>
        </div>
      </div>

      {/* Entry list */}
      <ScrollArea.ScrollArea ref={scrollRef} rootClassName="h-0 grow" viewportClassName="px-2">
        <div className="mx-auto max-w-[clamp(45ch,60vw,65ch)] pl-4 pr-3">
          {isLoading ? (
            <LoadingSkeleton />
          ) : data?.data.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {/* Thread line container */}
              <div className="relative ml-[7px] border-l-2 border-border">
                {data?.data.map((post: PostItem) => (
                  <PublicEntryItem
                    key={post.id}
                    post={post}
                    isActive={activePostId === post.id}
                    onSelect={onSelectPost}
                  />
                ))}
              </div>

              {/* Pagination */}
              {data && (data.hasMore || page > 1) && (
                <div className="flex items-center justify-center gap-4 py-6">
                  <ActionButton
                    disabled={page <= 1 || isFetching}
                    onClick={() => setPage(Math.max(1, page - 1))}
                    tooltip="Previous"
                  >
                    <i className="i-mgc-left-cute-fi" />
                  </ActionButton>

                  <span className="text-sm text-text-secondary">
                    {page} / {Math.ceil(data.total / LIMIT)}
                  </span>

                  <ActionButton
                    disabled={!data.hasMore || isFetching}
                    onClick={() => setPage(page + 1)}
                    tooltip="Next"
                  >
                    <i className="i-mgc-right-cute-re" />
                  </ActionButton>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea.ScrollArea>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-1">
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
      <SkeletonItem />
    </div>
  )
}

function SkeletonItem() {
  return (
    <div className="flex py-4">
      <Skeleton className="mr-2 size-5 rounded-sm" />
      <div className="-mt-0.5 flex-1 text-sm leading-tight">
        <div className="flex gap-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
        <Skeleton className="mt-1.5 h-3.5 w-full" />
        <Skeleton className="mt-1 h-3.5 w-3/4" />
        <Skeleton className="mt-1.5 h-3 w-full" />
      </div>
      <Skeleton className="ml-2 size-20 rounded" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
      <i className="i-mgc-inbox-cute-re text-4xl" />
      <p className="mt-4 text-sm">No posts yet</p>
    </div>
  )
}
