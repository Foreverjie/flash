import { useIsDark } from "@follow/hooks"

/**
 * Brand-color CSS variables that `text-brand-accent` and friends rely on.
 * Apply this on any top-level mobile-web container that lives outside the
 * MobileWebShell (e.g. the /settings route shell), otherwise the vars are
 * undefined and accent colors fall back to inherited / transparent values.
 */
export function useMobileBrandStyle(): React.CSSProperties {
  const isDark = useIsDark()

  return {
    "--fo-accent-ink": isDark ? "#fde047" : "#8a5d00",
    "--fo-brand-accent": "var(--fo-accent)",
    "--fo-brand-accent-pressed": "var(--fo-accent-press)",
    "--fo-brand-accent-tint": "var(--accent-20)",
    "--fo-brand-accent-muted": "var(--accent-60)",
  } as React.CSSProperties
}
