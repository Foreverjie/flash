import type { PropertyListing } from "@follow/database/schemas/types"
import { useEntry } from "@follow/store/entry/hooks"

import { RelativeTime } from "~/components/ui/datetime"
import { Media } from "~/components/ui/media/Media"

const layoutLabel = (p: PropertyListing) => {
  const parts: string[] = []
  if (p.beds) parts.push(`${p.beds}室`)
  if (p.halls) parts.push(`${p.halls}厅`)
  if (p.baths) parts.push(`${p.baths}卫`)
  return parts.join("") || "—"
}

function SpecCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background p-4">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        {label}
      </div>
      <div className="text-sm font-medium text-text">{value || "—"}</div>
    </div>
  )
}

/**
 * Native Property Feed detail — the reader surface for community listings,
 * aligned with the imported Claude "Property reader" design: eyebrow, community
 * title, location, price, hero photo, a hairline spec grid, tags, and blurb.
 */
export function PropertyDetail({
  entryId,
  property: p,
}: {
  entryId: string
  property: PropertyListing
}) {
  const entry = useEntry(entryId, (e) => ({
    media: e.media?.[0],
    publishedAt: e.publishedAt,
    url: e.url,
  }))
  const image = entry?.media

  return (
    <div className="mx-auto mb-32 mt-12 max-w-full">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
        <span>房源</span>
        {!!entry?.publishedAt && (
          <>
            <span className="opacity-50">·</span>
            <RelativeTime date={entry.publishedAt} />
            <span>更新</span>
          </>
        )}
        {p.badge === "new" && (
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold tracking-normal text-black">
            新上
          </span>
        )}
        {p.badge === "reduced" && (
          <span className="rounded bg-red px-1.5 py-0.5 text-[10px] font-bold tracking-normal text-white">
            降价{p.reduced_by ? ` ${p.reduced_by}` : ""}
          </span>
        )}
        {p.sold && (
          <span className="rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold tracking-normal text-white">
            已售
          </span>
        )}
      </div>

      <h1 className="text-4xl font-bold leading-tight tracking-tight text-text">{p.community}</h1>

      {(p.hood || p.city) && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
          <i className="i-mgc-location-cute-re text-text-tertiary" />
          {[p.hood, p.city].filter(Boolean).join(" · ")}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-baseline gap-3">
        <span className="text-[2.4rem] font-extrabold leading-none tracking-tight text-text">
          {p.total}
        </span>
        {!!p.unit && <span className="text-sm text-text-tertiary">{p.unit}</span>}
        {p.badge === "reduced" && !!p.orig && (
          <span className="text-sm text-text-tertiary line-through opacity-70">{p.orig}</span>
        )}
      </div>

      {image && (
        <Media
          src={image.url}
          type={image.type}
          previewImageUrl={image.preview_image_url}
          className="mt-6 aspect-[16/9] w-full overflow-hidden rounded-2xl"
          mediaContainerClassName="w-full h-full object-cover"
          proxy={{ width: 1080, height: 608 }}
          blurhash={image.blurhash}
        />
      )}

      <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
        <SpecCell label="户型" value={layoutLabel(p)} />
        <SpecCell label="面积" value={p.area ? `${p.area}㎡` : "—"} />
        <SpecCell label="楼层" value={p.floor} />
        <SpecCell label="朝向" value={p.orientation ? `${p.orientation}向` : "—"} />
        <SpecCell label="装修" value={p.reno} />
        <SpecCell label="单价" value={p.unit || "—"} />
      </div>

      {p.tags?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {p.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-fill px-2.5 py-1 text-xs font-medium text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {!!p.title && (
        <p className="mt-5 text-[0.95rem] leading-relaxed text-text-secondary">{p.title}</p>
      )}

      {!!entry?.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-5 text-sm font-semibold text-black no-underline"
        >
          查看房源
          <i className="i-mgc-arrow-right-up-cute-re" />
        </a>
      )}
    </div>
  )
}
