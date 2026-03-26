import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Avatar, AvatarFallback, AvatarImage } from "@follow/components/ui/avatar/index.jsx"
import { Button } from "@follow/components/ui/button/index.js"
import { PresentSheet } from "@follow/components/ui/sheet/Sheet.js"
import { cn } from "@follow/utils/utils"
import type { PropsWithChildren } from "react"
import { createContext, use, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router"

import { useIsInMASReview, useServerConfigs } from "~/atoms/server-configs"
import { PlainModal } from "~/components/ui/modal/stacked/custom-modal"
import { useModalStack } from "~/components/ui/modal/stacked/hooks"
import { useFeature } from "~/hooks/biz/useFeature"
import { replaceImgUrlIfNeed } from "~/lib/img-proxy"
import { LoginModalContent } from "~/modules/auth/LoginModalContent"
import { usePresentUserProfileModal } from "~/modules/profile/hooks"
import { useSettingModal } from "~/modules/settings/modal/use-setting-modal-hack"
import { signOut, useSession } from "~/queries/auth"

const MobileGlobalDrawerContext = createContext<{
  isOpen: boolean
  open: () => void
  close: () => void
} | null>(null)

export function MobileGlobalDrawerProvider({ children }: PropsWithChildren) {
  const isMobile = useMobile()
  const [open, setOpen] = useState(false)

  const value = useMemo(
    () => ({
      isOpen: open,
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    [open],
  )

  return (
    <MobileGlobalDrawerContext value={value}>
      {children}
      {isMobile && (
        <PresentSheet
          open={open}
          onOpenChange={setOpen}
          title=""
          hideHeader
          modalClassName="border-t border-border bg-theme-background pt-3"
          contentClassName="min-h-0 px-4 pb-safe-offset-4"
          content={<MobileGlobalDrawerContent onClose={() => setOpen(false)} />}
        />
      )}
    </MobileGlobalDrawerContext>
  )
}

export function MobileGlobalDrawerTrigger({
  className,
  compact,
  tone = "header",
}: {
  className?: string
  compact?: boolean
  tone?: "header" | "elevated"
}) {
  const isMobile = useMobile()
  const ctx = use(MobileGlobalDrawerContext)
  const { t } = useTranslation()
  const { status, session } = useSession()

  if (!isMobile || !ctx) return null

  const user = session?.user

  if (compact) {
    return (
      <button
        type="button"
        className={cn(
          "relative flex size-11 shrink-0 items-center justify-center rounded-full text-text-secondary transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background active:scale-[0.97]",
          tone === "elevated"
            ? "border border-border/60 bg-material-ultra-thin shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:bg-material-thin"
            : "border border-transparent bg-fill-quaternary hover:bg-fill-tertiary",
          className,
        )}
        onClick={ctx.open}
        aria-label={t("words.menu", { defaultValue: "Menu" })}
        aria-haspopup="dialog"
        aria-expanded={ctx.isOpen}
      >
        {status === "authenticated" && user ? (
          <>
            <DrawerAvatar
              name={user.name}
              image={user.image}
              className={cn(
                "size-8 border-0 shadow-none",
                tone === "header" && "ring-1 ring-border/40",
              )}
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border border-theme-background bg-fill-secondary text-[10px] text-text-secondary">
              <i className="i-mgc-more-1-cute-re scale-75" />
            </span>
          </>
        ) : (
          <i className="i-mgc-menu-cute-re text-lg" />
        )}
      </button>
    )
  }

  return (
    <Button
      buttonClassName={cn(
        "flex h-11 items-center gap-2 rounded-full border border-border/70 bg-material-medium px-3.5 text-text shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background",
        className,
      )}
      onClick={ctx.open}
      aria-expanded={ctx.isOpen}
    >
      {status === "authenticated" && user ? (
        <>
          <DrawerAvatar name={user.name} image={user.image} />
          <span className="max-w-[80px] truncate text-sm font-medium">
            {user.name || user.handle}
          </span>
        </>
      ) : (
        <>
          <i className="i-mgc-compass-3-cute-re text-base text-text-secondary" />
          <span className="text-sm font-medium">
            {t("discover.find_feeds_title", { defaultValue: "Browse" })}
          </span>
        </>
      )}
    </Button>
  )
}

function MobileGlobalDrawerContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const settingModalPresent = useSettingModal()
  const { present } = useModalStack()
  const { status, session } = useSession()
  const serverConfig = useServerConfigs()
  const isInMASReview = useIsInMASReview()
  const aiEnabled = useFeature("ai")
  const presentUserProfile = usePresentUserProfileModal("drawer")

  const user = session?.user

  const primaryItems = useMemo(
    () => [
      {
        icon: "i-mgc-add-cute-re",
        title: t("words.discover"),
        description: t("discover.add_feed", { defaultValue: "Find and add new sources" }),
        onClick: () => navigate("/discover"),
      },
      {
        icon: "i-mgc-world-2-cute-re",
        title: t("words.explore"),
        description: t("explore.hero_subtitle", {
          defaultValue: "Browse curated feeds before you follow",
        }),
        onClick: () => navigate("/explore"),
      },
    ],
    [navigate, t],
  )

  const toolItems = useMemo(
    () =>
      [
        aiEnabled
          ? {
              icon: "i-mgc-ai-cute-re",
              title: t("user_button.ai"),
              description: t("ai.welcome_input", { defaultValue: "Open your assistant workspace" }),
              onClick: () => navigate("/ai"),
            }
          : null,
        {
          icon: "i-mgc-magic-2-cute-re",
          title: t("words.actions"),
          description: t("words.actions", { defaultValue: "Run quick actions" }),
          onClick: () => navigate("/action"),
        },
        !isInMASReview
          ? {
              icon: "i-mgc-rss-cute-re",
              title: t("words.rsshub"),
              description: t("words.rsshub", { defaultValue: "Open feed route tools" }),
              onClick: () => navigate("/rsshub"),
            }
          : null,
      ].filter(Boolean) as Array<{
        icon: string
        title: string
        description: string
        onClick: () => void
      }>,
    [aiEnabled, isInMASReview, navigate, t],
  )

  return (
    <div className="space-y-4 pb-2 pt-1">
      <div className="flex justify-center pb-1">
        <div className="h-1.5 w-12 rounded-full bg-fill-secondary" />
      </div>

      <div
        className="overflow-hidden rounded-[28px] border border-border/70 bg-material-ultra-thin p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        style={{
          backgroundImage:
            "radial-gradient(circle at top left, rgba(255,92,0,0.12), transparent 34%), radial-gradient(circle at top right, rgba(14,165,233,0.1), transparent 28%)",
        }}
      >
        {status === "authenticated" && user ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <DrawerAvatar
                name={user.name}
                image={user.image}
                className="size-14 shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold leading-tight text-text">
                  {user.name || user.handle}
                </div>
                {!!user.handle && (
                  <div className="mt-0.5 truncate text-sm text-text-secondary">@{user.handle}</div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-full bg-fill-tertiary/90 px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                    <i className="i-mgc-sparkles-2-cute-re" />
                    {t("discover.find_feeds_title", { defaultValue: "Account" })}
                  </div>
                  {!isInMASReview && serverConfig?.PAYMENT_ENABLED && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full bg-fill-tertiary px-2.5 py-1 text-[11px] font-medium text-text-secondary transition-all duration-200 hover:bg-fill-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background active:scale-[0.98]"
                      onClick={() => {
                        onClose()
                        settingModalPresent("plan")
                      }}
                    >
                      <i className="i-mgc-flashlight-cute-re" />
                      {t("activation.plan.title")}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <InlineActionButton
                icon="i-mgc-user-3-cute-re"
                label={t("user_button.profile")}
                onClick={() => {
                  onClose()
                  presentUserProfile(user.id)
                }}
              />
              <InlineActionButton
                icon="i-mgc-settings-7-cute-re"
                label={t("user_button.preferences")}
                onClick={() => {
                  onClose()
                  settingModalPresent()
                }}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[20px] bg-fill-tertiary text-text shadow-[0_8px_18px_rgba(15,23,42,0.12)]">
                <i className="i-mgc-compass-3-cute-re text-2xl" />
              </div>
              <div>
                <div className="text-base font-semibold leading-tight text-text">
                  {t("public_timeline.login_cta")}
                </div>
                <div className="mt-1 text-sm leading-6 text-text-secondary">
                  {t("discover.find_feeds_description", {
                    defaultValue:
                      "Sign in to sync your feeds and make this reading space feel like yours.",
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <InlineActionButton
                icon="i-mgc-user-3-cute-re"
                label={t("words.login")}
                tone="primary"
                onClick={() => {
                  onClose()
                  present({
                    CustomModalComponent: PlainModal,
                    title: "Login",
                    id: "login",
                    content: () => (
                      <LoginModalContent runtime={window.electron ? "app" : "browser"} />
                    ),
                    clickOutsideToDismiss: true,
                  })
                }}
              />
              <InlineActionButton
                icon="i-mgc-world-2-cute-re"
                label={t("words.explore")}
                onClick={() => {
                  onClose()
                  navigate("/explore")
                }}
              />
            </div>

            <div className="bg-theme-background/80 rounded-2xl border border-border/60 px-3 py-2 text-xs leading-5 text-text-secondary">
              {t("explore.hero_subtitle", {
                defaultValue:
                  "Browse public feeds now, then sign in when you want to follow and save.",
              })}
            </div>
          </div>
        )}
      </div>

      <SectionCard>
        <SectionHeader
          label={t("discover.find_feeds_title", { defaultValue: "Browse and add" })}
          description={t("explore.hero_subtitle", {
            defaultValue: "Find sources and preview what is worth following.",
          })}
        />
        <div className="mt-2.5 space-y-2">
          {primaryItems.map((item) => (
            <LargeActionRow
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
              onClick={() => {
                onClose()
                item.onClick()
              }}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          label={t("words.settings", { defaultValue: "More tools" })}
          description={t("words.actions", {
            defaultValue: "Open assistant, utilities, and advanced shortcuts.",
          })}
        />
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          {toolItems.map((item) => (
            <SmallActionTile
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
              onClick={() => {
                onClose()
                item.onClick()
              }}
            />
          ))}
        </div>
      </SectionCard>

      {status === "authenticated" && (
        <SectionCard>
          <SectionHeader
            label={t("user_button.preferences", { defaultValue: "Session" })}
            description={t("user_button.log_out", {
              defaultValue: "Leave this account on this device.",
            })}
          />
          <div className="mt-2.5">
            <Button
              variant="outline"
              buttonClassName="h-11 w-full justify-center border-red/20 bg-red/5 text-red hover:bg-red/10 focus-visible:ring-red/40"
              onClick={() => {
                onClose()
                signOut()
              }}
            >
              <i className="i-mgc-exit-cute-re mr-2" />
              {t("user_button.log_out")}
            </Button>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function DrawerAvatar({
  name,
  image,
  className,
}: {
  name?: string | null
  image?: string | null
  className?: string
}) {
  return (
    <Avatar
      className={cn("size-8 rounded-full border border-border/70 bg-fill-tertiary", className)}
    >
      <AvatarImage src={replaceImgUrlIfNeed(image || undefined)} />
      <AvatarFallback className="bg-fill-secondary text-xs font-semibold text-text">
        {(name || "?").slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
      {children}
    </div>
  )
}

function SectionHeader({ label, description }: { label: string; description?: string }) {
  return (
    <div className="px-1">
      <SectionLabel>{label}</SectionLabel>
      {description && (
        <div className="mt-1 text-xs leading-5 text-text-tertiary">{description}</div>
      )}
    </div>
  )
}

function SectionCard({ children }: PropsWithChildren) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-material-ultra-thin p-3">
      {children}
    </div>
  )
}

function LargeActionRow({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-theme-background/90 group flex min-h-16 w-full items-center gap-3 rounded-[22px] border border-border/60 px-4 py-3 text-left transition-all duration-200 hover:border-border hover:bg-fill-quaternary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background active:scale-[0.99]"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[18px] bg-fill-tertiary text-text transition-colors duration-200 group-hover:bg-fill-secondary">
        <i className={cn(icon, "text-lg")} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight text-text">{title}</div>
        <div className="mt-1 text-xs leading-5 text-text-tertiary">{description}</div>
      </div>
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-fill-quaternary text-text-tertiary transition-colors duration-200">
        <i className="i-mgc-right-cute-re" />
      </div>
    </button>
  )
}

function SmallActionTile({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string
  title: string
  description?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-theme-background/90 group flex min-h-[112px] flex-col items-start justify-between rounded-[22px] border border-border/60 p-4 text-left transition-all duration-200 hover:border-border hover:bg-fill-quaternary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background active:scale-[0.99]"
    >
      <div className="flex size-11 items-center justify-center rounded-[18px] bg-fill-tertiary text-text transition-colors duration-200">
        <i className={cn(icon, "text-lg")} />
      </div>
      <div>
        <div className="text-sm font-medium leading-tight text-text">{title}</div>
        {description && (
          <div className="mt-1 text-xs leading-5 text-text-tertiary">{description}</div>
        )}
      </div>
    </button>
  )
}

function InlineActionButton({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: string
  label: string
  tone?: "default" | "primary"
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-theme-background active:scale-[0.99]",
        tone === "primary"
          ? "border border-orange/20 bg-orange/10 text-text hover:bg-orange/15"
          : "bg-theme-background/90 border border-border/60 text-text hover:border-border hover:bg-fill-quaternary",
      )}
    >
      <i
        className={cn(
          icon,
          "text-base",
          tone === "primary" ? "text-orange" : "text-text-secondary",
        )}
      />
      <span>{label}</span>
    </button>
  )
}
