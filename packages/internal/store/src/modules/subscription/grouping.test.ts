import { describe, expect, it } from "vitest"

/**
 * Mirrors the category resolution inside `useFeedsGroupedData`. Extracted here
 * because the hook itself needs the feed store seeded, while the bug lived
 * purely in this expression.
 *
 * Regression: scraper-backed feeds (`leyoujia_community://`, `bilibili_up_video://`,
 * `x_timeline://`) carry no `siteUrl`, so `getDefaultCategory` returned null.
 * With autoGroup on, that null fell through the `if (category)` guard and the
 * subscription vanished from the sidebar entirely.
 */
const resolveCategory = ({
  category,
  feedId,
  defaultCategory,
  autoGroup,
}: {
  category: string | null
  feedId: string
  defaultCategory: string | null
  autoGroup: boolean
}) => category || (autoGroup ? defaultCategory : null) || feedId

describe("feed grouping category resolution", () => {
  it("keeps an explicit category", () => {
    expect(
      resolveCategory({
        category: "Tech",
        feedId: "feed-1",
        defaultCategory: "Example",
        autoGroup: true,
      }),
    ).toBe("Tech")
  })

  it("falls back to the siteUrl-derived category when autoGroup is on", () => {
    expect(
      resolveCategory({
        category: null,
        feedId: "feed-1",
        defaultCategory: "Example",
        autoGroup: true,
      }),
    ).toBe("Example")
  })

  it("falls back to the feedId when no category can be derived", () => {
    // A scraper-backed feed: no category, no siteUrl to group by.
    expect(
      resolveCategory({
        category: null,
        feedId: "850254000000000001",
        defaultCategory: null,
        autoGroup: true,
      }),
    ).toBe("850254000000000001")
  })

  it("groups by feedId when autoGroup is off", () => {
    expect(
      resolveCategory({
        category: null,
        feedId: "feed-1",
        defaultCategory: "Example",
        autoGroup: false,
      }),
    ).toBe("feed-1")
  })

  it("never resolves to a falsy category, which would drop the feed", () => {
    for (const autoGroup of [true, false]) {
      expect(
        resolveCategory({ category: null, feedId: "feed-1", defaultCategory: null, autoGroup }),
      ).toBeTruthy()
    }
  })
})
