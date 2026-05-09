import { EmptyStage } from "@follow/components/ui/empty/index.js"
import { cn } from "@follow/utils/utils"

export interface EmptyStateProps {
  message: string
  icon?: string
  className?: string
}

export const EmptyState = ({ message, icon, className }: EmptyStateProps) => (
  <div className={cn("flex w-full justify-center px-4 py-6", className)}>
    <EmptyStage
      glyph={icon ? <span className="text-2xl">{icon}</span> : null}
      title={message}
      size="sm"
    />
  </div>
)
