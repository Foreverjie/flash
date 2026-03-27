interface VideoCardContentProps {
  thumbnailUrl?: string
  duration?: number
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function VideoCardContent({ thumbnailUrl, duration }: VideoCardContentProps) {
  return (
    <div className="relative overflow-hidden rounded-xl">
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="max-h-60 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-fill-tertiary" />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-black/50">
          <i className="i-mgc-play-cute-fi ml-0.5 text-xl text-white" />
        </div>
      </div>
      {duration != null && (
        <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium text-white">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  )
}
