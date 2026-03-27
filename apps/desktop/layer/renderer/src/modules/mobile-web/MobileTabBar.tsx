import { cn } from "@follow/utils/utils"
import { NavLink } from "react-router"

const tabs = [
  { to: "/", icon: "i-mgc-home-3-cute", label: "Home" },
  { to: "/discover", icon: "i-mgc-compass-cute", label: "Discover" },
  {
    to: "/notifications",
    icon: "i-mgc-notification-cute",
    label: "Notifications",
    showBadge: true,
  },
  { to: "/profile", icon: "i-mgc-user-3-cute", label: "Profile" },
] as const

export function MobileTabBar() {
  // TODO: Replace with actual unread count from notification store when available
  const unreadCount = 0

  return (
    <nav
      aria-label="Main navigation"
      className="bg-system-background flex h-[50px] shrink-0 items-center border-t border-border pb-safe-area-bottom"
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
              <i className={cn(tab.icon + (isActive ? "-fi" : "-re"), "text-2xl")} />
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
