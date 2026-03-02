import { ActionButton } from "@follow/components/ui/button/index.js"
import { Skeleton } from "@follow/components/ui/skeleton/index.jsx"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import type { PostItem } from "~/queries/posts"
import { usePostsQuery } from "~/queries/posts"

import { PostCard } from "./post-card"

export function Explore() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const limit = 30

  const { data, isLoading, isFetching } = usePostsQuery(page, limit)

  return (
    <div className="mx-auto mt-4 w-full max-w-[800px] space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xl font-bold">
          <i className="i-mgc-world-2-cute-re text-xl" />
          <span>{t("words.explore")}</span>
        </div>
        <div className="text-sm text-text-secondary">{data && `${data.total} posts`}</div>
      </div>

      {/* Posts List */}
      <div className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-[120px] w-full rounded-lg" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
            <Skeleton className="h-[120px] w-full rounded-lg" />
          </>
        ) : (
          data?.data.map((post: PostItem) => <PostCard key={post.id} post={post} />)
        )}
      </div>

      {/* Pagination */}
      {data && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <ActionButton
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            tooltip="Previous"
          >
            <i className="i-mgc-left-cute-fi" />
          </ActionButton>

          <span className="text-sm text-text-secondary">
            {page} / {Math.ceil(data.total / limit)}
          </span>

          <ActionButton
            disabled={!data.hasMore || isFetching}
            onClick={() => setPage((p) => p + 1)}
            tooltip="Next"
          >
            <i className="i-mgc-right-cute-re" />
          </ActionButton>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
          <i className="i-mgc-inbox-cute-re text-4xl" />
          <p className="mt-4 text-sm">No posts yet. Feeds will be synced automatically.</p>
        </div>
      )}
    </div>
  )
}
