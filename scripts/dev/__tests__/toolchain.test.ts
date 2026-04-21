// scripts/dev/__tests__/toolchain.test.ts
import { describe, expect, it } from "vitest"

import { compareSemver, satisfiesRange } from "../preflight/toolchain"

describe("compareSemver", () => {
  it("returns 0 for equal", () => {
    expect(compareSemver("20.19.0", "20.19.0")).toBe(0)
  })
  it("returns negative when a < b", () => {
    expect(compareSemver("20.18.5", "20.19.0")).toBeLessThan(0)
    expect(compareSemver("19.0.0", "20.0.0")).toBeLessThan(0)
  })
  it("returns positive when a > b", () => {
    expect(compareSemver("20.19.1", "20.19.0")).toBeGreaterThan(0)
    expect(compareSemver("22.0.0", "20.99.99")).toBeGreaterThan(0)
  })
  it("handles v-prefix", () => {
    expect(compareSemver("v20.19.0", "20.19.0")).toBe(0)
  })
  it("handles missing patch", () => {
    expect(compareSemver("20.19", "20.19.0")).toBe(0)
  })
})

describe("satisfiesRange", () => {
  it("accepts >= for major.minor.patch", () => {
    expect(satisfiesRange("22.12.0", ">=22.12.0")).toBe(true)
    expect(satisfiesRange("22.11.9", ">=22.12.0")).toBe(false)
  })
  it("accepts ^ within same major", () => {
    expect(satisfiesRange("20.19.0", "^20.19.0")).toBe(true)
    expect(satisfiesRange("20.99.0", "^20.19.0")).toBe(true)
    expect(satisfiesRange("20.18.0", "^20.19.0")).toBe(false)
    expect(satisfiesRange("21.0.0", "^20.19.0")).toBe(false)
  })
  it("accepts || alternation", () => {
    const range = "^20.19.0 || >=22.12.0"
    expect(satisfiesRange("20.19.5", range)).toBe(true)
    expect(satisfiesRange("22.12.0", range)).toBe(true)
    expect(satisfiesRange("23.0.0", range)).toBe(true)
    expect(satisfiesRange("21.5.0", range)).toBe(false)
    expect(satisfiesRange("20.18.0", range)).toBe(false)
  })
})
