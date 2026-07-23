import { useEntry } from "@follow/store/entry/hooks"
import { useFeedById } from "@follow/store/feed/hooks"
import { cn } from "@follow/utils/utils"

import { RelativeTime } from "~/components/ui/datetime"
import { Media } from "~/components/ui/media/Media"

import { ListItem } from "../templates/list-item-template"
import type { UniversalItemProps } from "../types"

// Community listing feeds set the post title to "「prefix」 | price · area · layout".
// Parse it back into the pieces the card renders.
function parseHeadline(title: string) {
  const hasPrefix = title.includes(" | ")
  const prefix = hasPrefix ? title.slice(0, title.indexOf(" | ")).trim() : ""
  const body = hasPrefix ? title.slice(title.indexOf(" | ") + 3) : title
  const [price = "", ...specs] = body.split(" · ")
  return { prefix, price, specs }
}

/**
 * Property Feed card — renders community (real-estate) listings as cards in the
 * timeline, aligned with the imported Claude "Property Feed" design. Built from
 * list-available fields (title, media, feed title); the reader shows the full card.
 */
export function PropertyItem({ entryId, translation }: UniversalItemProps) {
  const entry = useEntry(entryId, (e) => ({
    title: e.title,
    media: e.media,
    publishedAt: e.publishedAt,
    feedId: e.feedId,
  }))
  const community = useFeedById(entry?.feedId, (feed) => feed.title)

  // Missing data (e.g. non-listing entry routed here) → fall back to the list row.
  if (!entry?.title) return <ListItem entryId={entryId} translation={translation} />

  const { prefix, price, specs } = parseHeadline(entry.title)
  const image = entry.media?.[0]
  const isNew = prefix.includes("新上")
  const isReduced = prefix.includes("降价")

  return (
    <div className="mx-1 my-1.5 overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      {image && (
        <div className="relative">
          <Media
            src={image.url}
            type={image.type}
            previewImageUrl={image.preview_image_url}
            className="aspect-[16/9] w-full"
            mediaContainerClassName="w-full h-full object-cover"
            loading="lazy"
            proxy={{ width: 640, height: 360 }}
            blurhash={image.blurhash}
          />
          {(isNew || isReduced) && (
            <div className="absolute left-3 top-3 flex gap-2">
              {isNew && (
                <span className="rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-black shadow">
                  新上
                </span>
              )}
              {isReduced && (
                <span className="rounded-lg bg-red px-2.5 py-1 text-xs font-bold text-white shadow">
                  {prefix.replace(/^📉\s*/, "")}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-accent">{community}</span>
          {!!entry.publishedAt && (
            <span className="shrink-0 text-[11px] text-text-tertiary">
              <RelativeTime date={entry.publishedAt} />
            </span>
          )}
        </div>

        <div className="text-[26px] font-extrabold leading-none tracking-tight text-text">
          {price}
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
      </div>
    </div>
  )
}

PropertyItem.wrapperClassName = cn("px-2")
