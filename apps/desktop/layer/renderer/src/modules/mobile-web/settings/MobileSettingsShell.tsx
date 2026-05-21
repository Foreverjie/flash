import { cn } from "@follow/utils/utils"
import { atom, useSetAtom } from "jotai"
import type { PropsWithChildren } from "react"
import { use, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import {
  SettingModalContentPortalableContext,
  SettingTabProvider,
  useSetSettingTab,
  useSettingTab,
} from "~/modules/settings/modal/context"
import { getMemoizedSettings } from "~/modules/settings/settings-glob"

import { useMobileBrandStyle } from "../mobile-brand-style"

export function MobileSettingsShell({ children }: PropsWithChildren) {
  const portalableCtxValue = useMemo(() => atom(null as any), [])

  return (
    <SettingTabProvider>
      <SettingModalContentPortalableContext value={portalableCtxValue}>
        <MobileSettingsShellInner>{children}</MobileSettingsShellInner>
      </SettingModalContentPortalableContext>
    </SettingTabProvider>
  )
}

function MobileSettingsShellInner({ children }: PropsWithChildren) {
  const { t } = useTranslation("common")
  const { t: tSettings } = useTranslation("settings")
  const navigate = useNavigate()
  const location = useLocation()
  const colorVars = useMobileBrandStyle()

  // Some shared settings components (e.g. PaidBadge) drive navigation via
  // useSetSettingTab. Bridge that atom to the route so those interactions
  // navigate the mobile shell, while route-driven changes silently sync the
  // atom so a stale value can't bounce the user back later.
  const requestedTab = useSettingTab()
  const setRequestedTab = useSetSettingTab()
  const currentTab = location.pathname.startsWith("/settings/")
    ? location.pathname.slice("/settings/".length).replace(/\/$/, "")
    : ""
  const prevRequestedRef = useRef(requestedTab)
  useEffect(() => {
    const requestedChanged = requestedTab !== prevRequestedRef.current
    prevRequestedRef.current = requestedTab
    if (requestedChanged && requestedTab && requestedTab !== currentTab) {
      navigate(`/settings/${requestedTab}`)
      return
    }
    if (requestedTab !== currentTab) {
      setRequestedTab(currentTab)
    }
  }, [requestedTab, currentTab, navigate, setRequestedTab])

  // At /settings root we show the categories list (with a Done button to dismiss).
  // At /settings/<tab> we show a back arrow returning to /settings.
  const isRoot = location.pathname === "/settings" || location.pathname === "/settings/"

  const activeTitle = useMemo(() => {
    if (isRoot) return t("words.settings")
    const tab = getMemoizedSettings().find((s) => s.path === currentTab)
    return tab ? tSettings(tab.name as never) : t("words.settings")
  }, [isRoot, currentTab, t, tSettings])

  return (
    <div
      className="relative flex h-screen flex-col overflow-hidden bg-background"
      style={colorVars}
    >
      <header
        className={cn(
          "relative flex items-center justify-between gap-2 bg-background",
          "h-12 shrink-0 border-b border-border px-2 pt-safe-area-top",
        )}
      >
        {isRoot ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 text-sm text-brand-accent"
          >
            {t("words.done")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/settings")}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border-0 bg-transparent px-2 text-sm text-brand-accent"
            aria-label={t("words.back")}
          >
            <i className="i-mgc-arrow-left-cute-re size-4" />
            {t("words.settings")}
          </button>
        )}

        <h1 className="pointer-events-none absolute left-1/2 max-w-[60%] -translate-x-1/2 truncate text-base font-semibold text-text">
          {activeTitle}
        </h1>

        <span className="h-9 w-12" aria-hidden />
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto pb-safe-area-bottom">
        {isRoot ? children : <div className="px-4 pb-8 pt-1">{children}</div>}
      </main>
      <MobileSettingsPortalTarget />
    </div>
  )
}

const MobileSettingsPortalTarget = () => {
  const setElement = useSetAtom(use(SettingModalContentPortalableContext))
  return <div ref={setElement as any} />
}
