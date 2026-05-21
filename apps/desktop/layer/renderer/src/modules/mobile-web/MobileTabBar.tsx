import { useUnreadAll } from "@follow/store/unread/hooks"
import { cn } from "@follow/utils/utils"
import { NavLink } from "react-router"

interface TabItem {
  to: string
  icon: string
  label: string
  badgeKey?: "unreadAll"
}

const tabs: TabItem[] = [
  { to: "/timeline", icon: "i-mgc-home-5-cute", label: "Home", badgeKey: "unreadAll" },
  { to: "/discover", icon: "i-mgc-search-3-cute", label: "Discover" },
  { to: "/notifications", icon: "i-mgc-inbox-cute", label: "Notifications" },
  { to: "/profile", icon: "i-mgc-user-3-cute", label: "Profile" },
]

function formatBadgeCount(count: number): string {
  if (count <= 0) return ""
  if (count > 99) return "99+"
  return String(count)
}

export function MobileTabBar() {
  const unreadAll = useUnreadAll()

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-[50px] shrink-0 items-center border-t border-border bg-background pb-safe-area-bottom"
    >
      {tabs.map((tab) => {
        const count = tab.badgeKey === "unreadAll" ? unreadAll : 0
        const badge = formatBadgeCount(count)
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/timeline"}
            aria-label={badge ? `${tab.label}, ${count} unread` : tab.label}
            className={({ isActive }) =>
              cn(
                "relative flex flex-1 flex-col items-center justify-center py-2 transition-colors",
                isActive ? "text-brand-accent" : "text-text-tertiary",
              )
            }
          >
            {({ isActive }) => (
              <>
                <i className={cn(tab.icon + (isActive ? "-fi" : "-re"), "text-2xl")} />
                {badge && (
                  <span
                    className={cn(
                      "absolute right-[28%] top-1 flex min-w-[16px] items-center justify-center rounded-full px-1",
                      "h-4 text-[10px] font-semibold leading-none text-white",
                      "bg-red",
                    )}
                  >
                    {badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}
