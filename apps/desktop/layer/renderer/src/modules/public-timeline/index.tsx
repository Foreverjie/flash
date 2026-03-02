import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Folo } from "@follow/components/icons/folo.js"
import { Logo } from "@follow/components/icons/logo.jsx"
import { ActionButton } from "@follow/components/ui/button/index.js"
import { PanelSplitter } from "@follow/components/ui/divider/PanelSplitter.js"
import { PresentSheet } from "@follow/components/ui/sheet/Sheet.js"
import { stopPropagation } from "@follow/utils/dom"
import { cn } from "@follow/utils/utils"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"

import { useUISettingKey } from "~/atoms/settings/ui"

import { PublicEntryList } from "./entry-list"
import { PublicFeedSidebar } from "./feed-sidebar"
import { PostDetailContent, PostDetailPanel } from "./post-detail"

/**
 * PublicTimelineLayout — Renders when the user is not authenticated.
 * Three-column layout: Feed sidebar | Entry list | Detail panel.
 * On mobile (<1024px), detail opens as a bottom sheet.
 */
export function PublicTimelineLayout() {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null)
  const [selectedFeedTitle, setSelectedFeedTitle] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [activePostId, setActivePostId] = useState<string | null>(null)

  const feedColWidth = useUISettingKey("feedColWidth")
  const mobile = useMobile()

  const handleSelectFeed = useCallback((feedId: string | null, feedTitle?: string) => {
    setSelectedFeedId(feedId)
    setSelectedFeedTitle(feedTitle ?? null)
    setPage(1)
  }, [])

  const handleSelectPost = useCallback((postId: string) => {
    setActivePostId(postId)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setActivePostId(null)
  }, [])

  const { t } = useTranslation()

  return (
    <>
      {/* Left sidebar: Subscription/Feed Column */}
      <div
        className="relative flex h-full flex-col pt-2.5"
        style={{ width: `${feedColWidth}px`, flexShrink: 0 }}
      >
        {/* Header mimics SubscriptionColumnHeader */}
        <div className="ml-4 mr-3 flex items-center justify-between">
          <div className="relative flex items-center gap-1 text-lg font-semibold">
            <Logo className="mr-1 size-6" />
            <Folo className="size-8" />
          </div>
          <div className="relative flex items-center gap-2" onClick={stopPropagation}>
            <Link to="/discover" tabIndex={-1}>
              <ActionButton shortcut="$mod+T" tooltip={t("words.discover")}>
                <i className="i-mgc-add-cute-re size-5 text-text-secondary" />
              </ActionButton>
            </Link>
            <Link to="/explore" tabIndex={-1}>
              <ActionButton tooltip={t("words.explore")}>
                <i className="i-mgc-world-2-cute-re size-5 text-text-secondary" />
              </ActionButton>
            </Link>
          </div>
        </div>

        {/* Feed list */}
        <div className="mt-3 flex h-0 grow flex-col">
          <PublicFeedSidebar selectedFeedId={selectedFeedId} onSelectFeed={handleSelectFeed} />
        </div>
      </div>

      <PanelSplitter isDragging={false} cursor="col-resize" />

      {/* Middle: Entry list */}
      <main
        className={cn(
          "flex min-w-0 flex-1 bg-theme-background",
          "pt-[calc(var(--fo-window-padding-top)_-10px)]",
        )}
      >
        <PublicEntryList
          selectedFeedId={selectedFeedId}
          selectedFeedTitle={selectedFeedTitle}
          page={page}
          setPage={setPage}
          activePostId={activePostId}
          onSelectPost={handleSelectPost}
        />
      </main>

      {/* Right: Detail panel (desktop) or Sheet (mobile) */}
      {mobile ? (
        <PresentSheet
          open={!!activePostId}
          onOpenChange={(open) => {
            if (!open) handleCloseDetail()
          }}
          content={
            activePostId ? (
              <PostDetailContent postId={activePostId} onClose={handleCloseDetail} />
            ) : null
          }
          title=""
          hideHeader
        />
      ) : (
        <>
          <PanelSplitter isDragging={false} cursor="col-resize" />
          <div
            className={cn(
              "flex h-full min-w-[380px] max-w-[50%] flex-1 bg-theme-background",
              "pt-[calc(var(--fo-window-padding-top)_-10px)]",
            )}
          >
            <PostDetailPanel postId={activePostId} onClose={handleCloseDetail} />
          </div>
        </>
      )}
    </>
  )
}
