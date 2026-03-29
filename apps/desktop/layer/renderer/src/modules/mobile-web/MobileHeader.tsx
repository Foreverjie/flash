import { useWhoami } from "@follow/store/user/hooks"
import { useSetAtom } from "jotai"
import { useLocation, useNavigate } from "react-router"

import { mobileDrawerOpenAtom } from "./atoms"

const TAB_ROUTES = new Set(["/", "/discover", "/notifications", "/profile"])

export function MobileHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const setDrawerOpen = useSetAtom(mobileDrawerOpenAtom)

  const user = useWhoami()

  const { pathname } = location

  // Drill-in header (non-tab routes)
  if (!TAB_ROUTES.has(pathname)) {
    return (
      <header className="flex h-11 shrink-0 items-center gap-2 px-4 pt-safe-area-top">
        <button
          type="button"
          aria-label="Go back"
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
          onClick={() => navigate(-1)}
        >
          <i className="i-mgc-left-cute-re text-xl" />
        </button>
      </header>
    )
  }

  // Home header
  if (pathname === "/") {
    return (
      <header className="flex h-11 shrink-0 items-center justify-between px-4 pt-safe-area-top">
        <button
          type="button"
          aria-label="Open account menu"
          className="flex size-9 items-center justify-center rounded-full"
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
        <span className="text-base font-semibold text-text">Flash</span>
        <button
          type="button"
          aria-label="Search"
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
        >
          <i className="i-mgc-search-cute-re text-xl" />
        </button>
      </header>
    )
  }

  // Discover header
  if (pathname === "/discover") {
    return (
      <header className="flex h-11 shrink-0 items-center px-4 pt-safe-area-top">
        <div className="flex h-9 flex-1 items-center rounded-full bg-fill-tertiary px-3 text-sm text-text-tertiary">
          <i className="i-mgc-search-cute-re mr-2" />
          Search feeds, topics...
        </div>
      </header>
    )
  }

  // Notifications header
  if (pathname === "/notifications") {
    return (
      <header className="flex h-11 shrink-0 items-center justify-center px-4 pt-safe-area-top">
        <span className="text-base font-semibold text-text">Notifications</span>
      </header>
    )
  }

  // Profile header
  if (pathname === "/profile") {
    return (
      <header className="flex h-11 shrink-0 items-center justify-between px-4 pt-safe-area-top">
        <div />
        <span className="text-base font-semibold text-text">Profile</span>
        <button
          type="button"
          aria-label="Settings"
          className="flex size-9 items-center justify-center rounded-full text-text-secondary"
        >
          <i className="i-mgc-settings-7-cute-re text-xl" />
        </button>
      </header>
    )
  }

  return null
}
