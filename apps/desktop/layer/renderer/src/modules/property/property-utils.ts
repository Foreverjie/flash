import type { PropertyListing } from "@follow/database/schemas/types"

/** Feed URL schemes whose entries are community property listings. */
export const COMMUNITY_FEED_SCHEMES = ["leyoujia_community://", "qfang_community://"]

const EMPTY_PROPERTY: PropertyListing = {
  community: "",
  listing_id: "",
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
  event: "",
  changes: [],
  price_change_num: 0,
  price_change_percent: 0,
  price_history: [],
  sold: false,
  image: "",
}

/** Parse the legacy "price · area · layout" title when structured data is unavailable. */
export function parseListingTitle(title: string, community: string): PropertyListing | null {
  const body = title.includes(" | ") ? title.slice(title.indexOf(" | ") + 3) : title
  const parts = body
    .split(" · ")
    .map((part) => part.trim())
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

export function resolvePropertyListing({
  property,
  feedUrl,
  feedTitle,
  entryTitle,
}: {
  property?: PropertyListing
  feedUrl?: string | null
  feedTitle?: string | null
  entryTitle?: string | null
}): PropertyListing | null {
  if (property) return property
  if (!feedUrl || !COMMUNITY_FEED_SCHEMES.some((scheme) => feedUrl.startsWith(scheme))) return null
  return parseListingTitle(entryTitle ?? "", feedTitle ?? "")
}
