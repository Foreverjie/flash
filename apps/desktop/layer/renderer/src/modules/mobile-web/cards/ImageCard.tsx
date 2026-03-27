interface ImageCardContentProps {
  images: Array<{ url: string; blurhash?: string }>
}

export function ImageCardContent({ images }: ImageCardContentProps) {
  const displayImages = images.slice(0, 6)
  const remaining = images.length - 6

  if (displayImages.length === 1) {
    return (
      <img
        src={displayImages[0].url}
        alt=""
        className="max-h-60 w-full rounded-xl object-cover"
      />
    )
  }

  if (displayImages.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {displayImages.map((img, i) => (
          <img key={i} src={img.url} alt="" className="aspect-square w-full rounded-xl object-cover" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {displayImages.map((img, i) => (
        <div key={i} className="relative aspect-square">
          <img src={img.url} alt="" className="size-full rounded-xl object-cover" />
          {i === 5 && remaining > 0 && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 text-sm font-semibold text-white">
              +{remaining}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
