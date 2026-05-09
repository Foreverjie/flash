/**
 * EmptyStage — empty / first-run state primitive.
 * Mirrors the onboarding "Stage" layout: eyebrow + glyph + title + body + optional CTA.
 */
import { cn } from "@follow/utils/utils"
import * as React from "react"

export interface EmptyStageProps {
  /** Uppercase tracked eyebrow above the glyph (renders in brand accent). */
  eyebrow?: React.ReactNode
  /** Icon / glyph element. Pass an `<i className="i-mgc-..." />` or any node. */
  glyph?: React.ReactNode
  /** Primary headline. */
  title: React.ReactNode
  /** Secondary supporting text. */
  body?: React.ReactNode
  /** Action area (typically a primary button) rendered below the body. */
  action?: React.ReactNode
  /** Compact variant — used inside narrow columns / sidebars. */
  size?: "sm" | "md" | "lg"
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

const SIZE_TO_TITLE: Record<NonNullable<EmptyStageProps["size"]>, string> = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-[28px]",
}

const SIZE_TO_GAP: Record<NonNullable<EmptyStageProps["size"]>, string> = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
}

const SIZE_TO_GLYPH: Record<NonNullable<EmptyStageProps["size"]>, string> = {
  sm: "text-2xl",
  md: "text-3xl",
  lg: "text-4xl",
}

export function EmptyStage({
  eyebrow,
  glyph,
  title,
  body,
  action,
  size = "md",
  className,
  onClick,
}: EmptyStageProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        SIZE_TO_GAP[size],
        className,
      )}
    >
      {eyebrow && (
        <div className="text-accent text-[11px] font-semibold uppercase tracking-[0.28em]">
          {eyebrow}
        </div>
      )}
      {glyph && <div className={cn("text-text-tertiary", SIZE_TO_GLYPH[size])}>{glyph}</div>}
      <div className={cn("text-text font-semibold tracking-[-0.015em]", SIZE_TO_TITLE[size])}>
        {title}
      </div>
      {body && (
        <div className="text-text-secondary max-w-md text-balance text-[13px] leading-normal">
          {body}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
