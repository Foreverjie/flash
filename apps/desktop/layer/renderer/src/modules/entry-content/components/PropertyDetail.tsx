import type { PropertyListing } from "@follow/database/schemas/types"
import { useEntry } from "@follow/store/entry/hooks"
import type { ReactNode } from "react"

import { RelativeTime } from "~/components/ui/datetime"
import { Media } from "~/components/ui/media/Media"

/** Feed URL schemes whose entries are community property listings. */
export const COMMUNITY_FEED_SCHEMES = ["leyoujia_community://", "qfang_community://"]

const EMPTY_PROPERTY: PropertyListing = {
  community: "",
  title: "",
  city: "",
  hood: "",
  beds: 0,
  halls: 0,
  baths: 0,
  area: 0,
  total: "",
  total_num: 0,
  unit: "",
  unit_num: 0,
  floor: "",
  orientation: "",
  reno: "",
  tags: [],
  badge: "",
  reduced_by: "",
  orig: "",
  sold: false,
  image: "",
}

/**
 * Minimal PropertyListing parsed from the post title ("price · area · layout"),
 * used as a fallback when the structured `property` field hasn't synced yet — so
 * community listings still render a native card, never the raw content HTML.
 */
export function parseListingTitle(title: string, community: string): PropertyListing | null {
  const body = title.includes(" | ") ? title.slice(title.indexOf(" | ") + 3) : title
  const parts = body
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean)
  const total = parts[0]
  if (!total) return null

  let area = 0
  let beds = 0
  let halls = 0
  for (const part of parts.slice(1)) {
    const areaMatch = part.match(/([\d.]+)\s*㎡/)
    if (areaMatch) area = Number(areaMatch[1])
    const layoutMatch = part.match(/(\d+)室(?:(\d+)厅)?/)
    if (layoutMatch) {
      beds = Number(layoutMatch[1])
      halls = layoutMatch[2] ? Number(layoutMatch[2]) : 0
    }
  }
  return { ...EMPTY_PROPERTY, community, total, area, beds, halls }
}

const layoutLabel = (p: PropertyListing) =>
  [p.beds ? `${p.beds}室` : "", p.halls ? `${p.halls}厅` : "", p.baths ? `${p.baths}卫` : ""]
    .filter(Boolean)
    .join(" · ") || "—"

function SpecCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="bg-background p-5">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">
        {label}
      </div>
      <div className="text-[15px] font-medium text-text">{value || "—"}</div>
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
    <div className="mx-auto mb-32 mt-10 max-w-full">
      {/* Eyebrow */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
        <span>房源</span>
        {!!entry?.publishedAt && (
          <>
            <span className="opacity-40">·</span>
            <RelativeTime date={entry.publishedAt} />
            <span className="-ml-1">更新</span>
          </>
        )}
        {p.badge === "new" && (
          <span className="rounded bg-accent px-2 py-0.5 text-[10px] font-bold tracking-normal text-black">
            新上
          </span>
        )}
        {p.badge === "reduced" && (
          <span className="rounded bg-red px-2 py-0.5 text-[10px] font-bold tracking-normal text-white">
            降价{p.reduced_by ? ` ${p.reduced_by}` : ""}
          </span>
        )}
        {p.sold && (
          <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold tracking-normal text-white">
            已售
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-text">
        {p.community}
      </h1>

      {/* Location */}
      {(p.hood || p.city) && (
        <div className="mt-3 flex items-center gap-1.5 text-sm text-text-secondary">
          <i className="i-mgc-location-cute-re shrink-0 text-text-tertiary" />
          {[p.hood, p.city].filter(Boolean).join(" · ")}
        </div>
      )}

      {/* Price */}
      <div className="mt-6 flex flex-wrap items-baseline gap-3">
        <span className="text-[2.75rem] font-extrabold leading-none tracking-tight text-text">
          {p.total}
        </span>
        {!!p.unit && <span className="text-sm text-text-tertiary">{p.unit}</span>}
        {p.badge === "reduced" && !!p.orig && (
          <span className="text-sm text-text-tertiary line-through opacity-70">{p.orig}</span>
        )}
      </div>

      {/* Hero */}
      {image && (
        <Media
          src={image.url}
          type={image.type}
          previewImageUrl={image.preview_image_url}
          className="mt-7 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border"
          mediaContainerClassName="w-full h-full object-cover"
          proxy={{ width: 1080, height: 608 }}
          blurhash={image.blurhash}
        />
      )}

      {/* Spec grid */}
      <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
        <SpecCell label="户型" value={layoutLabel(p)} />
        <SpecCell label="面积" value={p.area ? `${p.area}㎡` : "—"} />
        <SpecCell label="楼层" value={p.floor} />
        <SpecCell label="朝向" value={p.orientation ? `${p.orientation}向` : "—"} />
        <SpecCell label="装修" value={p.reno} />
        <SpecCell
          label="挂牌"
          value={entry?.publishedAt ? <RelativeTime date={entry.publishedAt} /> : "—"}
        />
      </div>

      {/* Tags */}
      {p.tags?.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {p.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-fill px-3 py-1.5 text-xs font-medium text-text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Blurb */}
      {!!p.title && (
        <p className="mt-6 text-[0.95rem] leading-relaxed text-text-secondary">{p.title}</p>
      )}

      {/* CTA */}
      {!!entry?.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex h-11 items-center gap-1.5 rounded-xl bg-accent px-6 text-sm font-semibold text-black no-underline transition-colors hover:bg-accent/90"
        >
          查看房源
          <i className="i-mgc-arrow-right-up-cute-re" />
        </a>
      )}
    </div>
  )
}
