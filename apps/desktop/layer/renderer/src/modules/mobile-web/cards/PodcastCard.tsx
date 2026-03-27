interface PodcastCardContentProps {
  duration?: number
  entryId: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function PodcastCardContent({ duration }: PodcastCardContentProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-accent text-white"
      >
        <i className="i-mgc-play-cute-fi ml-0.5 text-base" />
      </button>
      {duration != null && (
        <span className="text-sm text-text-secondary">{formatDuration(duration)}</span>
      )}
    </div>
  )
}
