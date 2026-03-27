interface ArticleCardContentProps {
  description?: string
  thumbnailUrl?: string
}

export function ArticleCardContent({ description, thumbnailUrl }: ArticleCardContentProps) {
  return (
    <div className="flex gap-3">
      {description && (
        <p className="min-w-0 flex-1 line-clamp-2 text-sm text-text-secondary">
          {description}
        </p>
      )}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          className="size-20 shrink-0 rounded-xl object-cover"
        />
      )}
    </div>
  )
}
