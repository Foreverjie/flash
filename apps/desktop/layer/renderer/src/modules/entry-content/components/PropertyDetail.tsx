import type { PropertyListing } from "@follow/database/schemas/types"
import { useEntry } from "@follow/store/entry/hooks"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { RelativeTime } from "~/components/ui/datetime"
import { Media } from "~/components/ui/media/Media"

function SpecCell({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 bg-background p-3 sm:p-4">
      <div className="mb-1 text-[10px] font-semibold uppercase text-text-tertiary">{label}</div>
      <div className="truncate text-[13px] font-medium text-text sm:text-sm">{value || "—"}</div>
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
  const { t } = useTranslation()
  const entry = useEntry(entryId, (e) => ({
    media: e.media?.find((media) => media.type === "photo"),
    publishedAt: e.publishedAt,
    url: e.url,
  }))
  const image = entry?.media
  const imageUrl = image?.url || p.image
  const layout =
    [
      p.beds ? t("property_detail.beds", { count: p.beds }) : "",
      p.halls ? t("property_detail.halls", { count: p.halls }) : "",
      p.baths ? t("property_detail.baths", { count: p.baths }) : "",
    ]
      .filter(Boolean)
      .join(" · ") || "—"

  return (
    <div className="mx-auto mb-16 max-w-full sm:mb-32">
      <div className="mb-2.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase text-[var(--fo-accent-ink)] sm:mb-3">
        <span>{t("property_detail.property")}</span>
        {!!entry?.publishedAt && (
          <>
            <span className="opacity-40">·</span>
            <span>{t("property_detail.updated")}</span>
            <RelativeTime date={entry.publishedAt} />
          </>
        )}
        {p.badge === "new" && (
          <span className="rounded bg-folo px-2 py-0.5 text-[10px] font-bold text-[#1a1207]">
            {t("property_detail.new")}
          </span>
        )}
        {p.badge === "reduced" && (
          <span className="rounded bg-red px-2 py-0.5 text-[10px] font-bold text-white">
            {t("property_detail.reduced", { amount: p.reduced_by })}
          </span>
        )}
        {p.sold && (
          <span className="rounded bg-text/75 px-2 py-0.5 text-[10px] font-bold text-background">
            {t("property_detail.sold")}
          </span>
        )}
      </div>

      <h1 className="text-[1.625rem] font-bold leading-tight text-text sm:text-[2rem]">
        {p.community}
      </h1>

      {(p.hood || p.city) && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
          <i className="i-mingcute-location-line shrink-0 text-text-tertiary" />
          {[p.hood, p.city].filter(Boolean).join(" · ")}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-baseline gap-2.5 sm:mt-5 sm:gap-3">
        <span className="text-[1.875rem] font-extrabold leading-none text-text sm:text-[2.25rem]">
          {p.total}
        </span>
        {!!p.unit && <span className="text-sm text-text-tertiary">{p.unit}</span>}
        {p.badge === "reduced" && !!p.orig && (
          <span className="text-sm text-text-tertiary line-through opacity-70">{p.orig}</span>
        )}
      </div>

      <div className="relative mt-5 aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-fill sm:mt-6 sm:aspect-video">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-tertiary">
          <i className="i-mgc-pic-cute-re size-5" />
          <span className="text-xs">{t("property_detail.photo_unavailable")}</span>
        </div>
        {imageUrl && (
          <Media
            src={imageUrl}
            type={image?.type ?? "photo"}
            previewImageUrl={image?.preview_image_url}
            className="absolute inset-0 size-full"
            mediaContainerClassName="size-full object-cover"
            proxy={{ width: 1080, height: 608 }}
            blurhash={image?.blurhash}
          />
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:mt-4 sm:grid-cols-3">
        <SpecCell label={t("property_detail.layout")} value={layout} />
        <SpecCell label={t("property_detail.floor_area")} value={p.area ? `${p.area}㎡` : "—"} />
        <SpecCell label={t("property_detail.floor")} value={p.floor} />
        <SpecCell label={t("property_detail.orientation")} value={p.orientation || "—"} />
        <SpecCell label={t("property_detail.renovation")} value={p.reno} />
        <SpecCell
          label={t("property_detail.listed")}
          value={entry?.publishedAt ? <RelativeTime date={entry.publishedAt} /> : "—"}
        />
      </div>

      {p.tags?.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
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

      {!!p.title && <p className="mt-5 text-sm leading-relaxed text-text-secondary">{p.title}</p>}

      {!!entry?.url && (
        <a
          href={entry.url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-folo px-5 text-sm font-semibold text-[#1a1207] no-underline transition-colors active:bg-[var(--fo-accent-press)] sm:h-10 sm:w-auto"
        >
          {t("property_detail.view_listing")}
          <i className="i-mgc-arrow-right-up-cute-re" />
        </a>
      )}
    </div>
  )
}
