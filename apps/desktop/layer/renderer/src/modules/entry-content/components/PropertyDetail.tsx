import type { PropertyListing } from "@follow/database/schemas/types"
import { useEntry } from "@follow/store/entry/hooks"
import { cn } from "@follow/utils/utils"
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

const changeLabelKeys = {
  price: "property_detail.change_price",
  unit_price: "property_detail.change_unit_price",
  title: "property_detail.change_title",
  area: "property_detail.change_area",
  layout: "property_detail.change_layout",
  floor: "property_detail.change_floor",
  orientation: "property_detail.change_orientation",
  renovation: "property_detail.change_renovation",
  tags: "property_detail.change_tags",
} as const

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
  const observedAt = p.observed_at || entry?.publishedAt
  const firstSeenAt = p.first_seen_at || entry?.publishedAt
  const priceChangeAmount = Math.abs(p.price_change_num || 0) / 10000
  const priceChangeDisplay = priceChangeAmount.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })
  const eventLabel = p.sold
    ? t("property_detail.sold")
    : p.event === "price_up" || p.badge === "increased"
      ? t("property_detail.increased", { amount: priceChangeDisplay })
      : p.event === "price_down" || p.badge === "reduced"
        ? t("property_detail.reduced", {
            amount: p.reduced_by || `${priceChangeDisplay}万`,
          })
        : p.event === "details_changed" || p.badge === "updated"
          ? t("property_detail.details_changed")
          : p.badge === "new"
            ? t("property_detail.new")
            : ""
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
        {!!observedAt && (
          <>
            <span className="opacity-40">·</span>
            <span>{t("property_detail.observed_at")}</span>
            <RelativeTime date={observedAt} />
          </>
        )}
        {!!eventLabel && (
          <span
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-bold",
              p.sold && "bg-text/75 text-background",
              !p.sold && (p.event === "price_down" || p.badge === "reduced") && "bg-red text-white",
              !p.sold &&
                (p.event === "price_up" || p.badge === "increased") &&
                "bg-green text-white",
              !p.sold &&
                p.event !== "price_down" &&
                p.event !== "price_up" &&
                p.badge !== "reduced" &&
                p.badge !== "increased" &&
                "bg-folo text-[#1a1207]",
            )}
          >
            {eventLabel}
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
        {(p.event === "price_down" || p.event === "price_up") && !!p.orig && (
          <span className="text-sm text-text-tertiary line-through opacity-70">{p.orig}</span>
        )}
      </div>

      {!!p.price_change_num && (
        <div
          className={cn(
            "mt-4 flex items-center gap-3 border-y border-border py-3",
            p.price_change_num < 0 ? "text-red" : "text-green",
          )}
        >
          {p.price_change_num < 0 ? (
            <i className="i-mgc-trending-up-cute-re size-5 shrink-0 rotate-180" />
          ) : (
            <i className="i-mgc-trending-up-cute-re size-5 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              {p.price_change_num < 0
                ? t("property_detail.price_change_summary_down", {
                    amount: priceChangeDisplay,
                    percent: Math.abs(p.price_change_percent).toFixed(1),
                  })
                : t("property_detail.price_change_summary_up", {
                    amount: priceChangeDisplay,
                    percent: Math.abs(p.price_change_percent).toFixed(1),
                  })}
            </div>
            {!!p.orig && (
              <div className="mt-0.5 text-[11px] font-normal text-text-tertiary">
                {t("property_detail.previous_price", { price: p.orig })}
              </div>
            )}
          </div>
        </div>
      )}

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
          label={t("property_detail.first_seen")}
          value={firstSeenAt ? <RelativeTime date={firstSeenAt} /> : "—"}
        />
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-text-tertiary">
        <i className="i-mgc-information-cute-re mt-0.5 shrink-0" />
        <span>{t("property_detail.time_source_note")}</span>
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

      {((p.price_history?.length ?? 0) > 1 || (p.changes?.length ?? 0) > 0) && (
        <section className="mt-7 border-t border-border pt-5">
          <h2 className="text-sm font-semibold text-text">{t("property_detail.activity")}</h2>

          {(p.price_history?.length ?? 0) > 1 && (
            <div className="mt-4">
              <div className="mb-3 text-[10px] font-semibold uppercase text-text-tertiary">
                {t("property_detail.price_history")}
              </div>
              <div>
                {p.price_history.map((point, index) => {
                  const olderPoint = p.price_history[index + 1]
                  const delta = olderPoint ? point.total_num - olderPoint.total_num : 0
                  const deltaLabel = `${delta > 0 ? "+" : "−"}${(
                    Math.abs(delta) / 10000
                  ).toLocaleString(undefined, { maximumFractionDigits: 1 })}万`
                  return (
                    <div
                      key={`${point.changed_at}-${point.total_num}`}
                      className="flex min-h-11 gap-3"
                    >
                      <div className="flex w-3 shrink-0 flex-col items-center">
                        <span
                          className={cn(
                            "mt-1.5 size-2 rounded-full border-2 border-background",
                            index === 0 ? "bg-accent" : "bg-fill-vibrant-tertiary",
                          )}
                        />
                        {index < p.price_history.length - 1 && (
                          <span className="w-px flex-1 bg-border" />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 items-start justify-between gap-3 pb-4">
                        <div>
                          <div className="text-sm font-semibold text-text">{point.total}</div>
                          <div className="mt-0.5 text-[10px] text-text-tertiary">
                            {index === 0 && <span>{t("property_detail.current_price")} · </span>}
                            <span>{t("property_detail.observed_at")}</span>{" "}
                            <RelativeTime date={point.changed_at} />
                          </div>
                        </div>
                        {!!delta && (
                          <span
                            className={cn(
                              "text-xs font-semibold tabular-nums",
                              delta < 0 ? "text-red" : "text-green",
                            )}
                          >
                            <span>{deltaLabel}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {(p.changes?.length ?? 0) > 0 && (
            <div className="mt-2 divide-y divide-border">
              {p.changes.map((change) => (
                <div key={change.field} className="grid grid-cols-[5rem_1fr] gap-3 py-3 text-xs">
                  <span className="text-text-tertiary">{t(changeLabelKeys[change.field])}</span>
                  <span className="min-w-0 text-text-secondary">
                    <span className="line-through opacity-60">{change.old || "—"}</span>
                    <i className="i-mgc-right-cute-re mx-2 text-text-quaternary" />
                    <span className="font-medium text-text">{change.new || "—"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
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
