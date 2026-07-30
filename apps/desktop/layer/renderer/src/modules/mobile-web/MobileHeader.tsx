import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import { TAB_ROUTES } from "./routes"

export function MobileHeader() {
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation("common")
  const location = useLocation()
  const navigate = useNavigate()

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

  // The home feed has no app header by design: the view filter pills are the
  // top chrome, and search/account live in the bottom nav (Discover / Me).
  if (pathname === "/timeline") {
    return null
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
