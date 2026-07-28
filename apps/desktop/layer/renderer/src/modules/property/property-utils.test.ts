import type { PropertyListing } from "@follow/database/schemas/types"
import { describe, expect, it } from "vitest"

import { resolvePropertyListing } from "./property-utils"

const property: PropertyListing = {
  community: "Sunshine Garden",
  title: "South-facing renovated apartment",
  city: "Shenzhen",
  hood: "Nanshan",
  beds: 3,
  halls: 2,
  baths: 2,
  area: 108,
  total: "¥8.6M",
  total_num: 8_600_000,
  unit: "¥79,630/㎡",
  unit_num: 79_630,
  floor: "High floor",
  orientation: "South",
  reno: "Renovated",
  tags: ["Near metro"],
  badge: "new",
  reduced_by: "",
  orig: "",
  sold: false,
  image: "",
}

describe("resolvePropertyListing", () => {
  it("prefers structured property data", () => {
    expect(resolvePropertyListing({ property })).toBe(property)
  })

  it("parses legacy community entry titles", () => {
    expect(
      resolvePropertyListing({
        feedUrl: "leyoujia_community://sunshine-garden",
        feedTitle: "Sunshine Garden",
        entryTitle: "Sunshine Garden | ¥8.6M · 108㎡ · 3室2厅",
      }),
    ).toMatchObject({
      community: "Sunshine Garden",
      total: "¥8.6M",
      area: 108,
      beds: 3,
      halls: 2,
    })
  })

  it("does not classify regular feeds as property listings", () => {
    expect(
      resolvePropertyListing({
        feedUrl: "https://example.com/rss.xml",
        feedTitle: "Example",
        entryTitle: "¥8.6M · 108㎡ · 3室2厅",
      }),
    ).toBeNull()
  })
})
