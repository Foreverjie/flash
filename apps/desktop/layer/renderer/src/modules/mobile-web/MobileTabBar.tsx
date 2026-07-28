import { useUnreadAll } from "@follow/store/unread/hooks"
import { cn } from "@follow/utils/utils"
import { NavLink } from "react-router"

interface TabItem {
  to: string
  icon: string
  activeIcon: string
  label: string
  badgeKey?: "unreadAll"
}

const tabs: TabItem[] = [
  {
    to: "/timeline",
    icon: "i-mgc-home-5-cute-re",
    activeIcon: "i-mgc-home-5-cute-fi",
    label: "Home",
    badgeKey: "unreadAll",
  },
  {
    to: "/discover",
    icon: "i-mgc-search-3-cute-re",
    activeIcon: "i-mgc-search-3-cute-fi",
    label: "Discover",
  },
  {
    to: "/notifications",
    icon: "i-mgc-inbox-cute-re",
    activeIcon: "i-mgc-inbox-cute-fi",
    label: "Notifications",
  },
  {
    to: "/profile",
    icon: "i-mgc-user-3-cute-re",
    activeIcon: "i-mgc-user-3-cute-fi",
    label: "Profile",
  },
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
      className="flex h-[calc(50px+var(--sab))] min-h-[50px] shrink-0 items-start border-t border-border bg-background pb-safe-area-bottom"
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
                "relative flex h-[50px] min-w-0 flex-1 flex-col items-center justify-center transition-colors",
                isActive ? "text-brand-accent" : "text-text-tertiary",
              )
            }
          >
            {({ isActive }) => (
              <>
                <i className={cn(isActive ? tab.activeIcon : tab.icon, "size-6")} />
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
