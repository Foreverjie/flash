import { describe, expect, it } from "vitest"

import { getTimelineViewportTransition } from "./responsive-timeline-route"

describe("getTimelineViewportTransition", () => {
  it("returns the mobile root when a desktop timeline becomes mobile", () => {
    expect(
      getTimelineViewportTransition({
        wasMobile: false,
        isMobile: true,
        pathname: "/timeline/view-0/all/pending",
      }),
    ).toBe("mobile-root")
  })

  it("returns the desktop default when the mobile root becomes desktop", () => {
    expect(
      getTimelineViewportTransition({
        wasMobile: true,
        isMobile: false,
        pathname: "/timeline",
      }),
    ).toBe("desktop-default")
  })

  it("does not rewrite initial loads or non-timeline routes", () => {
    expect(
      getTimelineViewportTransition({
        wasMobile: true,
        isMobile: true,
        pathname: "/timeline/view-0/feed/pending",
      }),
    ).toBeNull()
    expect(
      getTimelineViewportTransition({
        wasMobile: false,
        isMobile: true,
        pathname: "/discover",
      }),
    ).toBeNull()
    expect(
      getTimelineViewportTransition({
        wasMobile: false,
        isMobile: true,
        pathname: "/timeline-preview",
      }),
    ).toBeNull()
  })
})
