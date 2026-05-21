import { FeedViewType } from "@follow/constants"
import { useWhoami } from "@follow/store/user/hooks"
import { useAtomValue, useSetAtom } from "jotai"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import { mobileActiveViewAtom, mobileDrawerOpenAtom } from "./atoms"
import { TAB_ROUTES } from "./routes"

const VIEW_HEADINGS: Record<number, { eyebrow: string; title: string }> = {
  [FeedViewType.Articles]: { eyebrow: "Today", title: "Articles" },
  [FeedViewType.SocialMedia]: { eyebrow: "Live", title: "Social" },
  [FeedViewType.Pictures]: { eyebrow: "Visual", title: "Pictures" },
  [FeedViewType.Videos]: { eyebrow: "Watch", title: "Videos" },
  [FeedViewType.Audios]: { eyebrow: "Listen", title: "Audio" },
  [FeedViewType.Notifications]: { eyebrow: "Alerts", title: "Notifications" },
}

export function MobileHeader() {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const location = useLocation()
  const navigate = useNavigate()
  const setDrawerOpen = useSetAtom(mobileDrawerOpenAtom)
  const user = useWhoami()
  const activeView = useAtomValue(mobileActiveViewAtom)

  const { pathname } = location

  // Drill-in header (non-tab routes)
  if (!TAB_ROUTES.has(pathname)) {
    return (
      <header className="flex h-11 shrink-0 items-center gap-2 px-4 pt-safe-area-top">
        <button
          type="button"
          aria-label={tCommon("words.back")}
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
          onClick={() => navigate(-1)}
        >
          <i className="i-mgc-arrow-left-cute-re text-xl" />
        </button>
      </header>
    )
  }

  if (pathname === "/timeline") {
    const heading = VIEW_HEADINGS[activeView] ?? { eyebrow: "Today", title: "Articles" }
    return (
      <header className="flex shrink-0 items-end gap-2.5 px-4 pb-1.5 pt-safe-area-top">
        <div className="min-w-0 flex-1 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--fo-accent-ink)]">
            {heading.eyebrow}
          </div>
          <div className="mt-0.5 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-text">
            {heading.title}
          </div>
        </div>
        <button
          type="button"
          aria-label={t("words.search")}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill-tertiary text-text"
          onClick={() => navigate("/discover")}
        >
          <i className="i-mgc-search-cute-re text-lg" />
        </button>
        <button
          type="button"
          aria-label={t("mobile.header.open_account")}
          className="flex size-7 shrink-0 items-center justify-center rounded-full"
          onClick={() => setDrawerOpen(true)}
        >
          {user?.image ? (
            <img src={user.image} alt="" className="size-7 rounded-full object-cover" />
          ) : (
            <div className="flex size-7 items-center justify-center rounded-full bg-brand-accent text-xs font-semibold text-white">
              {user?.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
        </button>
      </header>
    )
  }

  if (pathname === "/discover") {
    return (
      <header className="flex h-11 shrink-0 items-center px-4 pt-safe-area-top">
        <button
          type="button"
          className="flex h-9 flex-1 items-center rounded-full bg-fill-tertiary px-3 text-left text-sm text-text-tertiary"
          aria-label={t("words.search")}
          onClick={() => navigate("/discover?type=search")}
        >
          <i className="i-mgc-search-cute-re mr-2" />
          <span className="truncate">{t("mobile.header.search_placeholder")}</span>
        </button>
      </header>
    )
  }

  if (pathname === "/notifications") {
    return (
      <header className="flex h-11 shrink-0 items-center justify-center px-4 pt-safe-area-top">
        <span className="text-base font-semibold text-text">{t("mobile.notifications.title")}</span>
      </header>
    )
  }

  if (pathname === "/profile") {
    return (
      <header className="flex h-11 shrink-0 items-center justify-between px-4 pt-safe-area-top">
        <div className="size-9" aria-hidden />
        <span className="text-base font-semibold text-text">{t("mobile.profile.title")}</span>
        <button
          type="button"
          aria-label={tCommon("words.settings")}
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
          onClick={() => navigate("/settings")}
        >
          <i className="i-mgc-settings-7-cute-re text-xl" />
        </button>
      </header>
    )
  }

  return null
}
