import { brandColors } from "@follow/constants"
import { useIsDark } from "@follow/hooks"
import { useMemo } from "react"

/**
 * Brand-color CSS variables that `text-brand-accent` and friends rely on.
 * Apply this on any top-level mobile-web container that lives outside the
 * MobileWebShell (e.g. the /settings route shell), otherwise the vars are
 * undefined and accent colors fall back to inherited / transparent values.
 */
export function useMobileBrandStyle(): React.CSSProperties {
  const isDark = useIsDark()
  return useMemo(
    () =>
      ({
        "--fo-brand-accent": isDark ? brandColors.accent.dark : brandColors.accent.light,
        "--fo-brand-accent-pressed": isDark
          ? brandColors.accentPressed.dark
          : brandColors.accentPressed.light,
        "--fo-brand-accent-tint": isDark
          ? brandColors.accentTint.dark
          : brandColors.accentTint.light,
        "--fo-brand-accent-muted": isDark
          ? brandColors.accentMuted.dark
          : brandColors.accentMuted.light,
      }) as React.CSSProperties,
    [isDark],
  )
}
