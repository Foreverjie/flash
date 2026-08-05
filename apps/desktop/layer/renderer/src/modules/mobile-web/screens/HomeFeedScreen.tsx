import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { useViewWithSubscription } from "@follow/store/subscription/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { useAtom, useSetAtom } from "jotai"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { useEntriesActions, useEntriesState } from "~/modules/entry-column/context/EntriesContext"

import { mobileActiveViewAtom, mobileReaderEntryIdAtom } from "../atoms"
import { EntryCard } from "../cards/EntryCard"
import { useViewSwipe } from "../useViewSwipe"
import { ViewPillTrack } from "../ViewPillTrack"

export function HomeFeedScreen() {
  const user = useWhoami()

  if (!user) {
    return <PublicHomeFeed />
  }

  return <AuthenticatedHomeFeed />
}

function PublicHomeFeed() {
  const { t } = useTranslation()
  const { present } = useModalStack()

  const openLogin = () => {
    present({
      id: "login",
      title: t("words.login"),
      CustomModalComponent: PlainModal,
      content: () => <LoginModalContent runtime="browser" />,
      clickOutsideToDismiss: true,
    })
  }

  return (
    <div className="flex flex-col items-center px-6 py-12">
      <EmptyStage
        eyebrow={t("mobile.home.welcome.title")}
        glyph={<i className="i-mgc-rss-cute-fi" />}
        title={t("mobile.home.welcome.title")}
        body={t("mobile.home.welcome.body")}
        size="md"
      />
      <button
        type="button"
        className="mt-6 rounded-full bg-brand-accent px-6 py-2.5 text-sm font-semibold text-[var(--fo-accent-fg)] transition-opacity active:opacity-80"
        onClick={openLogin}
      >
        {t("words.login")}
      </button>
    </div>
  )
}

function AuthenticatedHomeFeed() {
  const { t } = useTranslation()
  const state = useEntriesState()
  const actions = useEntriesActions()
  const scrollRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<HTMLDivElement>(null)
  const [filterBarHidden, setFilterBarHidden] = useState(false)

  const viewsWithSub = useViewWithSubscription()
  const [activeView, setActiveView] = useAtom(mobileActiveViewAtom)
  const setReaderEntryId = useSetAtom(mobileReaderEntryIdAtom)
  const navigate = useNavigate()
  const openFeed = useCallback((feedId: string) => navigate(`/feeds/${feedId}`), [navigate])

  useViewSwipe({
    containerRef: swipeRef,
    views: viewsWithSub,
    activeView,
    onSelect: setActiveView,
  })

  const { entriesIds, isLoading, isFetchingNextPage, hasNextPage } = state

  useEffect(() => {
    const el = scrollRef.current?.parentElement
    if (!el) return

    let lastScrollTop = 0
    let ticking = false

    const handleScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = el
        const delta = scrollTop - lastScrollTop
        if (Math.abs(delta) > 5) {
          setFilterBarHidden(delta > 0 && scrollTop > 44)
        }
        lastScrollTop = scrollTop
        if (scrollHeight - scrollTop - clientHeight < 500 && hasNextPage && !isFetchingNextPage) {
          actions.fetchNextPage()
        }
        ticking = false
      })
    }

    el.addEventListener("scroll", handleScroll, { passive: true })
    return () => el.removeEventListener("scroll", handleScroll)
  }, [hasNextPage, isFetchingNextPage, actions])

  return (
    <div ref={scrollRef} className="flex flex-col">
      <ViewPillTrack hidden={filterBarHidden} />
      {/* `pan-y` leaves vertical scrolling to the page and hands horizontal
          drags to the view swipe. */}
      <div ref={swipeRef} className="touch-pan-y will-change-transform">
        {isLoading && entriesIds.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => <EntryCardSkeleton key={i} />)
        ) : !isLoading && entriesIds.length === 0 ? (
          <div className="px-6 py-12">
            <EmptyStage
              eyebrow={t("mobile.home.empty.title")}
              glyph={<i className="i-mgc-inbox-cute-re" />}
              title={t("mobile.home.empty.title")}
              body={t("mobile.home.empty.body")}
              size="md"
            />
          </div>
        ) : (
          <>
            {entriesIds.map((id) => (
              <EntryCard
                key={id}
                entryId={id}
                view={activeView}
                onOpen={setReaderEntryId}
                onOpenFeed={openFeed}
              />
            ))}
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4">
                <i className="i-mgc-loading-3-cute-re animate-spin text-xl text-text-tertiary" />
              </div>
            )}
            {!hasNextPage && entriesIds.length > 0 && (
              <div className="py-6 text-center text-sm text-text-tertiary">
                {t("mobile.home.end")}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function EntryCardSkeleton() {
  return (
    <div className="border-b border-border/50 bg-background px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="size-[18px] animate-pulse rounded-sm bg-fill-tertiary" />
        <div className="h-3 w-24 animate-pulse rounded bg-fill-tertiary" />
        <div className="ml-auto h-3 w-12 animate-pulse rounded bg-fill-tertiary" />
      </div>
      <div className="mb-2 h-4 w-4/5 animate-pulse rounded bg-fill-tertiary" />
      <div className="flex gap-3">
        <div className="flex-1">
          <div className="mb-1 h-3 w-full animate-pulse rounded bg-fill-tertiary" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-fill-tertiary" />
        </div>
        <div className="size-20 animate-pulse rounded-xl bg-fill-tertiary" />
      </div>
    </div>
  )
}
