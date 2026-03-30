import { cn } from "@follow/utils/utils"
import { NavLink } from "react-router"

interface TabItem {
  to: string
  activeIcon: string
  inactiveIcon: string
  label: string
  showBadge?: boolean
}

const tabs: TabItem[] = [
  {
    to: "/",
    activeIcon: "i-mgc-home-3-cute-fi",
    inactiveIcon: "i-mgc-home-3-cute-re",
    label: "Home",
  },
  {
    to: "/discover",
    activeIcon: "i-mgc-compass-cute-fi",
    inactiveIcon: "i-mgc-compass-cute-re",
    label: "Discover",
  },
  {
    to: "/notifications",
    activeIcon: "i-mgc-notification-cute-fi",
    inactiveIcon: "i-mgc-notification-cute-re",
    label: "Notifications",
    showBadge: true,
  },
  {
    to: "/profile",
    activeIcon: "i-mgc-user-3-cute-fi",
    inactiveIcon: "i-mgc-user-3-cute-re",
    label: "Profile",
  },
]

export function MobileTabBar() {
  // TODO: Replace with actual unread count from notification store when available
  const unreadCount = 0

  return (
    <nav
      aria-label="Main navigation"
      className="flex h-[50px] shrink-0 items-center border-t border-border bg-background pb-safe-area-bottom"
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === "/"}
          aria-label={
            tab.showBadge && unreadCount > 0
              ? `${tab.label}, ${unreadCount} unread notifications`
              : tab.label
          }
          className={({ isActive }) =>
            cn(
              "relative flex flex-1 flex-col items-center justify-center py-2 transition-colors",
              isActive ? "text-brand-accent" : "text-text-tertiary",
            )
          }
        >
          {({ isActive }) => (
            <>
              <i className={cn(isActive ? tab.activeIcon : tab.inactiveIcon, "text-2xl")} />
              {tab.showBadge && unreadCount > 0 && (
                <span className="absolute right-1/4 top-1 size-2 rounded-full bg-brand-accent" />
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
