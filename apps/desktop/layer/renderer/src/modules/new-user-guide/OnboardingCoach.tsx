import { useMobile } from "@follow/components/hooks/useMobile.js"
import { Button } from "@follow/components/ui/button/index.js"
import { Kbd } from "@follow/components/ui/kbd/Kbd.js"
import { cn } from "@follow/utils/utils"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ONBOARDING_COACH_FLAG_KEY } from "~/constants/coach"

function readFlag() {
  try {
    return window.localStorage.getItem(ONBOARDING_COACH_FLAG_KEY) === "1"
  } catch {
    return false
  }
}

function clearFlag() {
  try {
    window.localStorage.removeItem(ONBOARDING_COACH_FLAG_KEY)
  } catch {
    // best-effort
  }
}

/**
 * One-shot coach card shown on the first read surface after onboarding.
 * Reads a localStorage flag set when the onboarding flow finishes; auto-dismisses
 * on first interaction and clears the flag so it never appears again.
 */
export function OnboardingCoach({ className }: { className?: string }) {
  const { t } = useTranslation()
  const isMobile = useMobile()
  const [visible, setVisible] = useState(() => readFlag())

  useEffect(() => {
    if (!visible) return
    // Auto-dismiss on first real user input so the card never blocks reading.
    const dismiss = () => {
      setVisible(false)
      clearFlag()
    }
    const opts = { once: true, passive: true } as AddEventListenerOptions
    window.addEventListener("keydown", dismiss, opts)
    window.addEventListener("pointerdown", dismiss, opts)
    return () => {
      window.removeEventListener("keydown", dismiss, opts)
      window.removeEventListener("pointerdown", dismiss, opts)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto fixed z-[60] flex max-w-[360px] flex-col gap-2.5 rounded-2xl",
        "shadow-modal bg-material-thick p-4 backdrop-blur-background",
        "border border-border",
        isMobile ? "inset-x-4 bottom-[68px]" : "bottom-6 right-6",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <i className="i-mgc-celebrate-cute-re size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text">{t("coach.welcome.title")}</div>
          <div className="mt-1 text-[13px] leading-snug text-text-secondary">
            {isMobile ? (
              t("coach.welcome.mobile_body")
            ) : (
              <DesktopBody body={t("coach.welcome.desktop_body")} />
            )}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          buttonClassName="h-7 px-3 text-xs"
          onClick={() => {
            setVisible(false)
            clearFlag()
          }}
        >
          {t("coach.welcome.cta")}
        </Button>
      </div>
    </div>
  )
}

// Inline keyboard hints inside the body copy by replacing literal j / k / o
// tokens with Kbd elements. Falls back to plain text if the translation
// doesn't contain the expected pattern.
function DesktopBody({ body }: { body: string }) {
  const parts = body.split(/\b([jko])\b/)
  if (parts.length === 1) return <span>{body}</span>
  return (
    <span>
      {parts.map((piece, i) =>
        piece === "j" || piece === "k" || piece === "o" ? (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <Kbd key={i} className="mx-0.5 px-1">
            {piece}
          </Kbd>
        ) : (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <span key={i}>{piece}</span>
        ),
      )}
    </span>
  )
}
