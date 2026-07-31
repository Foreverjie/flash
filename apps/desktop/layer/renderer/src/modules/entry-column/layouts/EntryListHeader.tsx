import { ActionButton, MotionButtonBase } from "@follow/components/ui/button/index.js"
import { DividerVertical } from "@follow/components/ui/divider/index.js"
import { RotatingRefreshIcon } from "@follow/components/ui/loading/index.jsx"
import { EllipsisHorizontalTextWithTooltip } from "@follow/components/ui/typography/index.js"
import { FeedViewType, getView } from "@follow/constants"
import { useIsOnline } from "@follow/hooks"
import { getFeedById } from "@follow/store/feed/getter"
import { useFeedById } from "@follow/store/feed/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { stopPropagation } from "@follow/utils/dom"
import { cn, isBizId } from "@follow/utils/utils"
import { useAtomValue } from "jotai"
import type { FC } from "react"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { previewBackPath } from "~/atoms/preview"
import { useGeneralSettingKey } from "~/atoms/settings/general"
import { useSubscriptionColumnShow } from "~/atoms/sidebar"
import { setTimelineTodayOnly, useTimelineTodayOnly } from "~/atoms/timeline"
import { isScraperBackedFeedUrl, ROUTE_ENTRY_PENDING } from "~/constants"
import { useFollow } from "~/hooks/biz/useFollow"
import { useNavigateEntry } from "~/hooks/biz/useNavigateEntry"
import { getRouteParams, useRouteParams } from "~/hooks/biz/useRouteParams"
import { COMMAND_ID } from "~/modules/command/commands/id"
import { useRunCommandFn } from "~/modules/command/hooks/use-command"
import { useCommandShortcut } from "~/modules/command/hooks/use-command-binding"
import { EntryHeader } from "~/modules/entry-content/components/entry-header"
import { FeedIcon } from "~/modules/feed/feed-icon"
import { useRefreshFeedMutation } from "~/queries/feed"
import { useFeedHeaderIcon, useFeedHeaderTitle } from "~/store/feed/hooks"

import { MarkAllReadButton } from "../components/mark-all-button"
import { useIsPreviewFeed } from "../hooks/useIsPreviewFeed"
import { useEntryRootState } from "../store/EntryColumnContext"
import { AppendTaildingDivider } from "./AppendTaildingDivider"
import { SwitchToMasonryButton } from "./buttons/SwitchToMasonryButton"

/** Bare hostname for the timeline sub-line; returns null for non-URL feed ids. */
const safeHostname = (value: string) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export const EntryListHeader: FC<{
  refetch: () => void
  isRefreshing: boolean
  hasUpdate: boolean
}> = ({ refetch, isRefreshing, hasUpdate }) => {
  const routerParams = useRouteParams()
  const { t } = useTranslation()

  const unreadOnly = useGeneralSettingKey("unreadOnly")

  const { feedId, entryId, view, isCollection } = routerParams
  const isPreview = useIsPreviewFeed()

  const headerTitle = useFeedHeaderTitle()
  const feedIcon = useFeedHeaderIcon()

  const user = useWhoami()
  const isOnline = useIsOnline()

  const feed = useFeedById(feedId)

  // `{host} · {N} readers` under the title. subscriptionCount only arrives for
  // real feeds (lists/inboxes have no host), so both halves are optional.
  const headerSubtitle = useMemo(() => {
    if (feed?.type !== "feed") return null
    const host = feed.siteUrl || feed.url ? safeHostname(feed.siteUrl || feed.url) : null
    const readers =
      typeof feed.subscriptionCount === "number" && feed.subscriptionCount > 0
        ? t("feed.readers", { count: feed.subscriptionCount })
        : null
    return [host, readers].filter(Boolean).join(" · ") || null
  }, [feed, t])

  const titleInfo = !!headerTitle && (
    <div className="flex min-w-0 items-center gap-2.5">
      {feedIcon && <FeedIcon target={feedIcon} fallback size={28} noMargin />}
      <div className="min-w-0 flex-1">
        <EllipsisHorizontalTextWithTooltip className="inline-block !w-auto max-w-full text-sm font-semibold leading-tight text-text">
          {headerTitle}
        </EllipsisHorizontalTextWithTooltip>
        {!!headerSubtitle && (
          <div className="truncate font-mono text-[11px] leading-tight text-text-tertiary">
            {headerSubtitle}
          </div>
        )}
      </div>
    </div>
  )
  const { mutateAsync: refreshFeed, isPending } = useRefreshFeedMutation(feedId)

  // Scraper-backed feeds have no fetchable URL — refreshing one asks the scraper
  // to re-scrape, which any subscriber may do. Owned feeds keep the old rule.
  const canRefreshFeed =
    isBizId(routerParams.feedId!) &&
    feed?.type === "feed" &&
    (feed?.ownerUserId === user?.id || isScraperBackedFeedUrl(feed?.url))

  const feedColumnShow = useSubscriptionColumnShow()
  const toggleUnreadOnlyShortcut = useCommandShortcut(COMMAND_ID.timeline.unreadOnly)
  const runCmdFn = useRunCommandFn()
  const navigateEntry = useNavigateEntry()

  const selectTimelineFilter = (nextUnreadOnly: boolean) => {
    if (isCollection) {
      navigateEntry({
        entryId: null,
        feedId: null,
        view,
      })
    }
    if (unreadOnly !== nextUnreadOnly) {
      runCmdFn(COMMAND_ID.timeline.unreadOnly, [nextUnreadOnly])()
    }
  }

  const { isScrolledBeyondThreshold } = useEntryRootState()
  const isScrolledBeyondThresholdValue = useAtomValue(isScrolledBeyondThreshold)
  return (
    <div
      className={cn(
        "flex w-full flex-col px-4 pt-2",
        !feedColumnShow && "macos:mt-4 macos:pt-margin-macos-traffic-light-y",
        isPreview
          ? "h-top-header-in-preview-with-border-b px-2.5 @[700px]:px-3 @[1024px]:px-4"
          : "h-20 border-b border-border",
      )}
      data-scrolled-beyond-threshold={isScrolledBeyondThresholdValue}
    >
      <div className="flex h-8 w-full items-start justify-between">
        {isPreview ? <PreviewHeaderInfoWrapper>{titleInfo}</PreviewHeaderInfoWrapper> : titleInfo}
        {!isPreview && (
          <div
            className={cn(
              "relative z-[1] flex items-center gap-2 self-baseline text-text-secondary",
              !headerTitle && "opacity-0 [&_*]:!pointer-events-none",

              "translate-x-[6px]",
            )}
            onClick={stopPropagation}
          >
            {getView(view)?.wideMode && entryId && entryId !== ROUTE_ENTRY_PENDING && (
              <>
                <EntryHeader entryId={entryId} />
                <DividerVertical className="mx-2 w-px" />
              </>
            )}

            <AppendTaildingDivider>
              {view === FeedViewType.Pictures && <SwitchToMasonryButton />}
            </AppendTaildingDivider>

            {isOnline &&
              (canRefreshFeed ? (
                <ActionButton
                  tooltip="Refresh"
                  onClick={() => {
                    // The scrape inserts server-side, so pull the new entries in
                    // afterwards. Errors already surface via the mutation's
                    // onError toast — swallow the rejection so it isn't unhandled.
                    refreshFeed()
                      .then(() => refetch())
                      .catch(() => {})
                  }}
                >
                  <RotatingRefreshIcon isRefreshing={isPending} />
                </ActionButton>
              ) : (
                <ActionButton
                  tooltip={
                    hasUpdate
                      ? t("entry_list_header.new_entries_available")
                      : t("entry_list_header.refetch")
                  }
                  onClick={() => {
                    refetch()
                  }}
                >
                  <RotatingRefreshIcon
                    className={cn(hasUpdate && "text-accent")}
                    isRefreshing={isRefreshing}
                  />
                </ActionButton>
              ))}
            {!isCollection && <MarkAllReadButton shortcut />}
          </div>
        )}
      </div>
      {/* Indeterminate progress while a refresh is in flight. */}
      <div
        aria-hidden
        className={cn(
          "relative -mt-px h-0.5 overflow-hidden rounded-full transition-opacity duration-200",
          isPending || isRefreshing ? "opacity-100" : "opacity-0",
        )}
      >
        <span className="absolute inset-y-0 left-0 w-2/5 animate-[entry-refresh-slide_1s_cubic-bezier(0.4,0,0.2,1)_infinite] rounded-full bg-gradient-to-r from-transparent via-accent to-transparent" />
      </div>
      {!isPreview && (
        <div className="mt-1.5 flex h-8 items-center gap-2" onClick={stopPropagation}>
          {/* Read state is one exclusive axis (segmented control); Today is an
              independent scope toggle (chip) — they combine. */}
          <div
            role="radiogroup"
            aria-label={t("words.unread")}
            className="flex items-center gap-0.5 rounded-[7px] bg-fill p-0.5"
          >
            <ReadStateSegmentButton
              active={!isCollection && unreadOnly}
              label={t("words.unread")}
              title={`${t("entry_list_header.show_unread_only")} (${toggleUnreadOnlyShortcut})`}
              onClick={() => selectTimelineFilter(true)}
            />
            <ReadStateSegmentButton
              active={!isCollection && !unreadOnly}
              label={t("words.all")}
              title={t("entry_list_header.show_all")}
              onClick={() => selectTimelineFilter(false)}
            />
          </div>
          <div className="h-3.5 w-px bg-border" />
          <TodayToggle isCollection={isCollection} />
        </div>
      )}
    </div>
  )
}

const ReadStateSegmentButton = ({
  active,
  label,
  title,
  onClick,
}: {
  active: boolean
  label: string
  title?: string
  onClick: () => void
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={active}
    title={title}
    className={cn(
      "flex h-5 items-center rounded-[5px] px-2 text-[11px] font-semibold transition-colors",
      active ? "bg-background text-text shadow-sm" : "text-text-tertiary hover:text-text",
    )}
    onClick={onClick}
  >
    {label}
  </button>
)

const TodayToggle = ({ isCollection }: { isCollection: boolean }) => {
  const { t } = useTranslation()
  const { view } = useRouteParams()
  const navigateEntry = useNavigateEntry()
  const todayOnly = useTimelineTodayOnly()
  return (
    <button
      type="button"
      aria-pressed={todayOnly}
      title={t("entry_list_header.show_today")}
      className={cn(
        "flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
        todayOnly
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-border text-text-tertiary hover:text-text",
      )}
      onClick={() => {
        // Clear any selected entry because it may fall outside the new scope.
        navigateEntry({ entryId: null, ...(isCollection && { feedId: null, view }) })
        setTimelineTodayOnly(!todayOnly)
      }}
    >
      <i className="i-mingcute-sun-line size-3" />
      {t("words.today")}
      {todayOnly && <i className="i-mgc-check-filled size-2.5" />}
    </button>
  )
}

const PreviewHeaderInfoWrapper: Component = ({ children }) => {
  const { t: tCommon } = useTranslation("common")
  const follow = useFollow()

  const navigate = useNavigate()
  return (
    <div className="flex w-full flex-col pt-1.5">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2">
        <MotionButtonBase
          onClick={(e) => {
            e.stopPropagation()
            navigate(previewBackPath() || "/")
          }}
          className="no-drag-region mr-1 inline-flex items-center gap-1 whitespace-nowrap duration-200 hover:text-accent"
        >
          <i className="i-mingcute-left-line" />
          <span className="text-sm font-medium">{tCommon("words.back")}</span>
        </MotionButtonBase>
        {children}
        <div />
      </div>

      <button
        type="button"
        className="-mx-4 mt-3.5 flex animate-gradient-x cursor-button place-items-center justify-center gap-1 bg-gradient-to-r from-accent/10 via-accent/15 to-accent/20 px-3 py-2 font-semibold text-accent transition-all duration-300 hover:bg-accent hover:text-white"
        onClick={() => {
          const { feedId, listId } = getRouteParams()
          const feed = getFeedById(feedId)
          follow({
            isList: !!listId,
            id: listId ?? feedId,
            url: feed?.type === "feed" ? feed.url : undefined,
          })
        }}
      >
        <i className="i-mgc-add-cute-fi size-4" />
        {tCommon("words.follow")}
      </button>
    </div>
  )
}
