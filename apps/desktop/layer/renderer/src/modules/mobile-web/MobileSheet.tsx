import { cn } from "@follow/utils/utils"
import { m } from "motion/react"
import { useEffect } from "react"

/**
 * Bottom sheet shell for mobile web: scrim + spring-up panel with a grabber.
 * Render it inside an `AnimatePresence` so the exit transition plays.
 */
export function MobileSheet({
  label,
  onClose,
  className,
  children,
}: {
  /** Accessible name for the dialog. */
  label: string
  onClose: () => void
  className?: string
  children: React.ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  return (
    <>
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <m.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 340 }}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          "shadow-modal fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background px-4 pb-safe-area-bottom pt-2.5",
          className,
        )}
      >
        <div aria-hidden className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-fill-tertiary" />
        {children}
      </m.div>
    </>
  )
}
