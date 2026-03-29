import type { ColorMode } from "@follow/hooks"
import { useThemeAtomValue } from "@follow/hooks"
import {
  useFeedSubscriptionCount,
  useListSubscriptionCount,
} from "@follow/store/subscription/hooks"
import { useUnreadAll } from "@follow/store/unread/hooks"
import { useWhoami } from "@follow/store/user/hooks"
import { cn } from "@follow/utils/utils"
import { useAtom } from "jotai"
import { AnimatePresence, m } from "motion/react"
import { useNavigate } from "react-router"

import { useSetTheme } from "~/hooks/common/useSyncTheme"
import { signOut } from "~/queries/auth"

import { mobileDrawerOpenAtom } from "./atoms"

export function MobileAccountDrawer() {
  const [isOpen, setIsOpen] = useAtom(mobileDrawerOpenAtom)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black"
            onClick={() => setIsOpen(false)}
          />
          <m.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 flex w-4/5 max-w-[320px] flex-col overflow-hidden bg-background pt-safe-area-top"
          >
            <DrawerContent onClose={() => setIsOpen(false)} />
          </m.div>
        </>
      )}
    </AnimatePresence>
  )
}

function DrawerContent({ onClose }: { onClose: () => void }) {
  const user = useWhoami()
  const navigate = useNavigate()
  const feedCount = useFeedSubscriptionCount()
  const listCount = useListSubscriptionCount()
  const totalSubs = feedCount + listCount
  const totalUnread = useUnreadAll()

  const handleNavigate = (path: string) => {
    onClose()
    navigate(path)
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-3">
      {/* User row */}
      <button
        type="button"
        className="flex items-center gap-3 pb-3"
        onClick={() => handleNavigate("/profile")}
      >
        {user?.image ? (
          <img src={user.image} alt="" className="size-10 rounded-full object-cover" />
        ) : (
          <div className="flex size-10 items-center justify-center rounded-full bg-brand-accent font-semibold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-sm font-semibold text-text">{user?.name || "Unknown"}</div>
          {user?.email && <div className="truncate text-xs text-text-tertiary">{user.email}</div>}
        </div>
      </button>

      {/* Stats row */}
      <div className="flex gap-4 border-b border-border/50 pb-3 text-sm">
        <span>
          <strong className="text-text">{totalSubs}</strong>{" "}
          <span className="text-text-tertiary">subscriptions</span>
        </span>
        <span>
          <strong className="text-text">{totalUnread}</strong>{" "}
          <span className="text-text-tertiary">unread</span>
        </span>
      </div>

      {/* Nav links */}
      <div className="flex flex-col border-b border-border/50 py-1">
        <NavLink
          icon="i-mgc-star-cute-re"
          label="Bookmarks"
          onClick={() => handleNavigate("/bookmarks")}
        />
        <NavLink
          icon="i-mgc-upload-cute-re"
          label="Import OPML"
          onClick={() => handleNavigate("/discover")}
        />
        <NavLink
          icon="i-mgc-settings-7-cute-re"
          label="Settings"
          onClick={() => handleNavigate("/settings")}
        />
      </div>

      {/* Theme selector */}
      <div className="flex items-center justify-between border-b border-border/50 py-3">
        <span className="text-sm text-text">Theme</span>
        <ThemeSelector />
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between pb-safe-area-bottom pt-3">
        <button
          type="button"
          className="text-sm text-text-secondary"
          onClick={() => {
            onClose()
            signOut()
          }}
        >
          Sign out
        </button>
        <span className="text-xs text-text-quaternary">v{APP_VERSION}</span>
      </div>
    </div>
  )
}

function NavLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors active:bg-fill-secondary"
      onClick={onClick}
    >
      <i className={cn(icon, "text-lg text-text-secondary")} />
      <span className="text-sm text-text">{label}</span>
    </button>
  )
}

const THEME_OPTIONS: { value: ColorMode; icon: string; label: string }[] = [
  { value: "light", icon: "i-mgc-sun-cute-re", label: "Light" },
  { value: "system", icon: "i-mgc-monitor-cute-re", label: "System" },
  { value: "dark", icon: "i-mgc-moon-cute-re", label: "Dark" },
]

function ThemeSelector() {
  const currentTheme = useThemeAtomValue()
  const setTheme = useSetTheme()

  return (
    <div className="flex gap-0.5 rounded-lg bg-fill-tertiary p-0.5">
      {THEME_OPTIONS.map(({ value, icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          className={cn(
            "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
            currentTheme === value ? "bg-background text-text shadow-sm" : "text-text-tertiary",
          )}
          onClick={() => setTheme(value)}
        >
          <i className={icon} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
