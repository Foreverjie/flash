import { Spring } from "@follow/components/constants/spring.js"
import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Logo } from "@follow/components/icons/logo.js"
import { MotionButtonBase } from "@follow/components/ui/button/index.js"
import { useIsDark } from "@follow/hooks"
import type { LoginRuntime } from "@follow/shared/auth"
import { stopPropagation } from "@follow/utils/dom"
import { cn } from "@follow/utils/utils"
import { AnimatePresence, m } from "motion/react"
import { useState } from "react"
import { Trans, useTranslation } from "react-i18next"

import { useServerConfigs } from "~/atoms/server-configs"
import { useCurrentModal, useModalStack } from "~/components/ui/modal/stacked/hooks"
import { authClient, loginHandler } from "~/lib/auth"
import { useAuthProviders } from "~/queries/users"

import { LoginWithPassword, RegisterForm } from "./Form"
import { ReferralForm } from "./ReferralForm"
import { TokenModalContent } from "./TokenModal"

const PROVIDER_SKELETON_KEYS = Array.from({ length: 4 }, (_, index) => `provider-skeleton-${index}`)

interface LoginModalContentProps {
  runtime: LoginRuntime
  canClose?: boolean
  initialState?: "register" | "login"
  onBack?: () => void
  /**
   * Render the form inline (no fixed modal card / outside-click dismiss) so it
   * can be embedded directly into a surface such as the onboarding welcome step.
   */
  embedded?: boolean
}

export const LoginModalContent = (props: LoginModalContentProps) => {
  const serverConfigs = useServerConfigs()

  const modal = useCurrentModal()
  const { present } = useModalStack()

  const { canClose = true, initialState, onBack, runtime, embedded = false } = props

  const { t } = useTranslation()
  const { data: authProviders, isLoading } = useAuthProviders()

  const isMobile = useMobile()

  const providers = Object.entries(authProviders || [])

  const initialLastMethod = authClient.getLastUsedLoginMethod()
  const [isRegister, setIsRegister] = useState(
    initialState ? initialState === "register" : !initialLastMethod,
  )
  const [isEmail, setIsEmail] = useState(false)
  const [lastMethod] = useState(() => {
    let m = initialLastMethod
    if (m === "email") m = "credential"
    return m
  })

  const handleOpenLegal = (type: "privacy" | "tos") => {
    const path = {
      privacy: "privacy-policy",
      tos: "terms-of-service",
    }

    window.open(`https://flash.app/${path[type]}`, "_blank")
  }

  const handleOpenToken = () => {
    present({
      id: "token",
      title: t("login.enter_token"),
      content: () => <TokenModalContent />,
    })
  }

  const isDark = useIsDark()

  const handleLoginStateChange = (state: "register" | "login") => {
    setIsRegister(state === "register")
  }

  const Inner = (
    <>
      {(isEmail || onBack) && (
        <div className="absolute left-7 top-5 z-10">
          <MotionButtonBase
            className="flex cursor-button items-center gap-1.5 text-center text-[13px] font-medium duration-200 hover:text-accent"
            onClick={() => {
              if (isEmail) {
                setIsEmail(false)
                return
              }
              onBack?.()
            }}
          >
            <i className="i-mgc-left-cute-fi" />
            {t("login.back")}
          </MotionButtonBase>
        </div>
      )}

      {/* Eyebrow */}
      <div className="mb-7 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
        Flash · Account
      </div>

      <div className="mb-5 flex items-center justify-center">
        <Logo className="size-[68px] rounded-[18px]" />
      </div>

      <h1 className="m-0 mb-1.5 text-center text-[28px] font-semibold tracking-[-0.02em] text-text">
        <span>{isRegister ? t("signin.sign_up_to") : t("signin.sign_in_to")}</span>
        <span> Flash</span>
      </h1>
      <p className="mb-7 text-center text-sm leading-normal text-text-secondary">
        {isRegister
          ? "Sync feeds across web, desktop, and mobile."
          : "Welcome back. Pick up where you left off."}
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {isEmail ? (
          <m.div
            key="email-form"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={Spring.presets.snappy}
          >
            {isRegister ? (
              <RegisterForm onLoginStateChange={handleLoginStateChange} />
            ) : (
              <LoginWithPassword runtime={runtime} onLoginStateChange={handleLoginStateChange} />
            )}
          </m.div>
        ) : (
          <m.div
            key="providers"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={Spring.presets.snappy}
          >
            <div className="flex flex-col gap-2.5">
              {isLoading
                ? PROVIDER_SKELETON_KEYS.map((key) => (
                    <div
                      key={key}
                      className="relative h-11 w-full animate-pulse rounded-[10px] border border-border bg-fill-tertiary"
                    />
                  ))
                : providers.map(([key, provider]) => (
                    <MotionButtonBase
                      key={key}
                      onClick={() => {
                        if (key === "credential") {
                          setIsEmail(true)
                        } else {
                          loginHandler(key, "app")
                        }
                      }}
                      className="relative flex h-11 w-full items-center justify-center gap-2 rounded-[10px] border border-border bg-transparent text-[13px] font-semibold duration-200 hover:bg-material-medium"
                    >
                      <img
                        className={cn(
                          "absolute left-4 h-5",
                          !provider.iconDark64 &&
                            "dark:brightness-[0.85] dark:hue-rotate-180 dark:invert",
                        )}
                        src={isDark ? provider.iconDark64 || provider.icon64 : provider.icon64}
                      />
                      <span>{t("login.continueWith", { provider: provider.name })}</span>
                      {lastMethod === key && (
                        <span
                          className="absolute -right-2 -top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: "var(--fo-accent)",
                            color: "var(--fo-accent-fg)",
                          }}
                        >
                          {t("login.lastUsed")}
                        </span>
                      )}
                    </MotionButtonBase>
                  ))}

              {isRegister && serverConfigs?.REFERRAL_ENABLED && (
                <ReferralForm className="mt-2 w-full" />
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {!isEmail && (
        <>
          <div className="mb-5 mt-6 flex items-center gap-3 text-[11px] uppercase tracking-widest text-text-tertiary">
            <span className="h-px flex-1 bg-border" />
            <span>or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <button
            type="button"
            className="w-full text-center text-[13px] font-medium text-text-secondary"
            onClick={() => setIsRegister(!isRegister)}
          >
            <Trans
              t={t}
              i18nKey={isRegister ? "login.have_account" : "login.no_account"}
              components={{
                strong: <span className="font-semibold text-accent" />,
              }}
            />
          </button>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-[11px]">
            <a
              onClick={() => handleOpenToken()}
              className="cursor-pointer text-text-tertiary hover:text-text-secondary"
            >
              {t("login.enter_token")}
            </a>
            <span className="text-text-tertiary">
              <a
                onClick={() => handleOpenLegal("tos")}
                className="cursor-pointer hover:text-accent"
              >
                {t("login.terms")}
              </a>{" "}
              ·{" "}
              <a
                onClick={() => handleOpenLegal("privacy")}
                className="cursor-pointer hover:text-accent"
              >
                {t("login.privacy")}
              </a>
            </span>
          </div>
        </>
      )}
    </>
  )
  if (embedded) {
    return <div className="relative mx-auto w-full max-w-sm">{Inner}</div>
  }

  if (isMobile) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-background px-4 pb-8 pt-12">
        <div className="w-full max-w-sm">{Inner}</div>
      </div>
    )
  }

  return (
    <div className="center flex h-full" onClick={canClose ? modal.dismiss : undefined}>
      <m.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={Spring.presets.snappy}
      >
        <div
          onClick={stopPropagation}
          tabIndex={-1}
          className="relative w-[28rem] rounded-2xl border border-border bg-background p-9 shadow-2xl shadow-stone-300 dark:shadow-stone-800"
          style={{ boxShadow: "var(--shadow-perfect, 0 24px 60px rgba(0,0,0,0.18))" }}
        >
          {Inner}
        </div>
      </m.div>
    </div>
  )
}
