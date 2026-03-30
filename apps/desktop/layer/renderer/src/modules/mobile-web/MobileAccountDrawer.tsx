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
import { useEffect } from "react"
import { useNavigate } from "react-router"

import { useReduceMotion } from "~/hooks/biz/useReduceMotion"
import { useSetTheme } from "~/hooks/common/useSyncTheme"
import { signOut } from "~/queries/auth"

import { mobileDrawerOpenAtom } from "./atoms"

export function MobileAccountDrawer() {
  const [isOpen, setIsOpen] = useAtom(mobileDrawerOpenAtom)
  const reduceMotion = useReduceMotion()

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [isOpen, setIsOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
            className="fixed inset-0 z-40 bg-black"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <m.div
            initial={{ x: reduceMotion ? 0 : "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: reduceMotion ? 0 : "-100%" }}
            transition={
              reduceMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 320 }
            }
            className="fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-[340px] flex-col overflow-hidden border-r border-border/50 bg-background/95 pt-safe-area-top shadow-2xl backdrop-blur-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Account drawer"
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
    <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-text-quaternary">
          Account
        </span>
        <button
          type="button"
          aria-label="Close account drawer"
          className="flex size-10 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-fill-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 active:scale-[0.98] active:bg-fill-tertiary"
          onClick={onClose}
        >
          <i className="i-mgc-close-cute-re text-xl" />
        </button>
      </div>

      <button
        type="button"
        className="flex items-center gap-3 rounded-2xl px-2 py-3 text-left transition-colors duration-200 hover:bg-fill-quaternary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 active:scale-[0.99] active:bg-fill-secondary"
        onClick={() => handleNavigate("/profile")}
      >
        {user?.image ? (
          <img src={user.image} alt="" className="size-11 rounded-full object-cover" />
        ) : (
          <div className="flex size-11 items-center justify-center rounded-full bg-brand-accent text-sm font-semibold text-white">
            {user?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-text">{user?.name || "Unknown"}</div>
          <div className="mt-0.5 truncate text-xs text-text-tertiary">
            {user?.email || "View profile"}
          </div>
        </div>
        <i className="i-mgc-right-cute-re shrink-0 text-base text-text-quaternary" />
      </button>

      <div className="grid grid-cols-2 gap-2 border-b border-border/50 py-4">
        <StatCard label="Subscriptions" value={totalSubs} />
        <StatCard label="Unread" value={totalUnread} />
      </div>

      <div className="flex flex-col border-b border-border/50 py-2">
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

      <div className="border-b border-border/50 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-text">Theme</div>
            <div className="text-xs text-text-tertiary">Choose how Flash looks</div>
          </div>
        </div>
        <ThemeSelector />
      </div>

      <div className="mt-auto flex items-center justify-between pb-safe-area-bottom pt-4">
        <button
          type="button"
          className="rounded-lg p-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-fill-quaternary hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 active:scale-[0.98] active:bg-fill-secondary"
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-fill-quaternary p-3">
      <div className="text-lg font-semibold leading-none text-text">{value}</div>
      <div className="mt-1 text-xs text-text-tertiary">{label}</div>
    </div>
  )
}

function NavLink({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors duration-200 hover:bg-fill-quaternary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 active:scale-[0.99] active:bg-fill-secondary"
      onClick={onClick}
    >
      <i className={cn(icon, "text-lg text-text-secondary")} />
      <span className="flex-1 text-sm text-text">{label}</span>
      <i className="i-mgc-right-cute-re text-base text-text-quaternary" />
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
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-fill-tertiary p-1">
      {THEME_OPTIONS.map(({ value, icon, label }) => (
        <button
          key={value}
          type="button"
          aria-label={label}
          className={cn(
            "flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl p-2 text-[11px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2",
            currentTheme === value
              ? "bg-background text-text shadow-sm"
              : "text-text-secondary hover:bg-fill-quaternary active:bg-fill-secondary",
          )}
          onClick={() => setTheme(value)}
        >
          <i className={cn(icon, "text-base")} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
