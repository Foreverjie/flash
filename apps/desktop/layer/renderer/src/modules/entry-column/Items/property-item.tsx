import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { cn } from "@follow/utils/utils"

import { RelativeTime } from "~/components/ui/datetime"
import { Media } from "~/components/ui/media/Media"

import { ListItem } from "../templates/list-item-template"
import type { UniversalItemProps } from "../types"

/**
 * Property Feed card — renders community (real-estate) listings as cards in the
 * timeline, aligned with the imported Claude "Property Feed" design. Driven by
 * the structured `property` field (carried in entry.extra).
 */
export function PropertyItem({ entryId, translation }: UniversalItemProps) {
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    media: e.media?.[0],
    publishedAt: e.publishedAt,
    feedId: e.feedId,
    property: e.extra?.property,
  }))
  const community = useFeedById(entry?.feedId, (feed) => feed.title)

  const p = entry?.property
  // No structured data yet (pre-sync) → fall back to the standard list row.
  if (!p) return <ListItem entryId={entryId} translation={translation} />

  const image = entry?.media
  const specs = [
    p.area ? `${p.area}㎡` : "",
    [
      p.beds ? `${p.beds}室` : "",
      p.halls ? `${p.halls}厅` : "",
      p.baths ? `${p.baths}卫` : "",
    ].join(""),
    p.orientation ? `${p.orientation}向` : "",
  ].filter(Boolean)

  return (
    <div
      className={cn(
        "mx-1 my-1.5 overflow-hidden rounded-2xl border border-border bg-background shadow-sm",
        "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        p.sold && "opacity-80",
      )}
    >
      {image && (
        <div className="relative">
          <Media
            src={image.url}
            type={image.type}
            previewImageUrl={image.preview_image_url}
            className={cn("aspect-[16/9] w-full", p.sold && "grayscale")}
            mediaContainerClassName="w-full h-full object-cover"
            loading="lazy"
            proxy={{ width: 640, height: 360 }}
            blurhash={image.blurhash}
          />
          <div className="absolute left-3 top-3 flex gap-2">
            {p.sold && (
              <span className="rounded-lg bg-black/70 px-2.5 py-1 text-xs font-bold tracking-wider text-white shadow">
                已售
              </span>
            )}
            {p.badge === "new" && (
              <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black shadow">
                新上
              </span>
            )}
            {p.badge === "reduced" && (
              <span className="rounded-lg bg-red px-2.5 py-1 text-xs font-bold text-white shadow">
                降价{p.reduced_by ? ` ${p.reduced_by}` : ""}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-accent">
            {community ?? p.community}
          </span>
          {!!entry.publishedAt && (
            <span className="shrink-0 text-[11px] text-text-tertiary">
              <RelativeTime date={entry.publishedAt} />
            </span>
          )}
        </div>

        {!!p.title && (
          <div className="mb-2 line-clamp-1 text-[15px] font-medium leading-snug text-text">
            {p.title}
          </div>
        )}

        <div className="flex items-baseline gap-2.5">
          <span className="text-2xl font-extrabold tracking-tight text-text">{p.total}</span>
          {!!p.unit && <span className="text-xs text-text-tertiary">{p.unit}</span>}
          {p.badge === "reduced" && !!p.orig && (
            <span className="text-xs text-text-tertiary line-through opacity-70">{p.orig}</span>
          )}
        </div>

        {specs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {specs.map((spec) => (
              <span
                key={spec}
                className="rounded-md bg-fill px-2.5 py-1 text-xs font-medium text-text-secondary"
              >
                {spec}
              </span>
            ))}
          </div>
        )}

        {(p.hood || p.city) && (
          <div className="mt-3 flex items-center gap-1 text-xs text-text-tertiary">
            <i className="i-mgc-location-cute-re" />
            {[p.hood, p.city].filter(Boolean).join(" · ")}
          </div>
        )}
      </div>
    </div>
  )
}

PropertyItem.wrapperClassName = cn("px-2")
