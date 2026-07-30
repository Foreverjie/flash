import type { PropertyListing } from "@follow/database/schemas/types"
import { cn } from "@follow/utils/utils"
import { useTranslation } from "react-i18next"

import { RelativeTime } from "~/components/ui/datetime"

interface PropertyCardProps {
  property: PropertyListing
  fallbackTitle?: string
  imageUrl?: string
  isRead: boolean
  publishedAt?: string | Date
  onOpen: () => void
}

export function PropertyCard({
  property,
  fallbackTitle,
  imageUrl,
  isRead,
  publishedAt,
  onOpen,
}: PropertyCardProps) {
  const { t } = useTranslation()
  const layout = [
    property.beds ? t("property_detail.beds", { count: property.beds }) : "",
    property.halls ? t("property_detail.halls", { count: property.halls }) : "",
    property.baths ? t("property_detail.baths", { count: property.baths }) : "",
  ]
    .filter(Boolean)
    .join(" · ")
  const specs = [
    { id: "area", value: property.area ? `${property.area}㎡` : "" },
    { id: "layout", value: layout },
    { id: "orientation", value: property.orientation },
  ].filter((spec) => spec.value)
  const priceChangeAmount = Math.abs(property.price_change_num || 0) / 10000
  const priceChangeDisplay = priceChangeAmount.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })
  const eventLabel = property.sold
    ? t("property_detail.sold")
    : property.event === "price_up" || property.badge === "increased"
      ? t("property_detail.increased", { amount: priceChangeDisplay })
      : property.event === "price_down" || property.badge === "reduced"
        ? t("property_detail.reduced", {
            amount: property.reduced_by || `${priceChangeDisplay}万`,
          })
        : property.event === "details_changed" || property.badge === "updated"
          ? t("property_detail.details_changed")
          : property.badge === "new"
            ? t("property_detail.new")
            : ""

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onOpen()
        }
      }}
      className="relative cursor-pointer border-b border-border/60 bg-background p-4 transition-colors active:bg-fill-secondary"
    >
      {!isRead && (
        <span aria-hidden className="absolute left-1 top-[22px] size-1.5 rounded-full bg-folo" />
      )}

      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[10px] font-bold uppercase text-[var(--fo-accent-ink)]">
          {t("property_detail.property")}
        </span>
        {!!eventLabel && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
              property.sold
                ? "bg-fill-secondary text-text-secondary"
                : "bg-brand-accent text-[var(--fo-accent-fg)]",
              !property.sold &&
                (property.event === "price_down" || property.badge === "reduced") &&
                "bg-red text-white",
              !property.sold &&
                (property.event === "price_up" || property.badge === "increased") &&
                "bg-green text-white",
            )}
          >
            {eventLabel}
          </span>
        )}
        {publishedAt && (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-text-tertiary">
            <span>{t("property_detail.observed_at")}</span>
            <RelativeTime date={publishedAt} />
          </span>
        )}
      </div>

      <div className="flex min-w-0 gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className={cn(
              "line-clamp-1 text-[17px] font-bold leading-6",
              isRead ? "text-text-secondary" : "text-text",
            )}
          >
            {property.community || fallbackTitle}
          </h3>

          {(property.hood || property.city) && (
            <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-text-tertiary">
              <i className="i-mingcute-location-line shrink-0" />
              <span className="truncate">
                {[property.hood, property.city].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}

          <div className="mt-3 flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-2xl font-extrabold leading-none text-text">
              {property.total}
            </span>
            {property.unit && (
              <span className="truncate text-[11px] text-text-tertiary">{property.unit}</span>
            )}
          </div>

          {!!property.price_change_num && (
            <div
              className={cn(
                "mt-1.5 flex items-center gap-1 text-[11px] font-semibold",
                property.price_change_num < 0 ? "text-red" : "text-green",
              )}
            >
              <span>{property.price_change_num < 0 ? "↓" : "↑"}</span>
              <span>{priceChangeDisplay}万</span>
              <span className="font-normal opacity-75">
                ({Math.abs(property.price_change_percent).toFixed(1)}%)
              </span>
              {!!property.orig && (
                <span className="ml-1 font-normal text-text-tertiary line-through">
                  {property.orig}
                </span>
              )}
            </div>
          )}

          {specs.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[12px] font-medium text-text-secondary">
              {specs.map((spec, index) => (
                <span key={spec.id} className="flex items-center gap-2">
                  {index > 0 && <span className="text-text-quaternary">·</span>}
                  {spec.value}
                </span>
              ))}
            </div>
          )}
        </div>

        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="aspect-[4/3] w-24 shrink-0 rounded-md bg-fill object-cover sm:w-32"
          />
        )}
      </div>

      {property.title && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-[1.45] text-text-tertiary">
          {property.title}
        </p>
      )}
    </article>
  )
}
