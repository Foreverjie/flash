// scripts/dev/__tests__/args.test.ts
import { describe, expect, it } from "vitest"

import { parseDevArgs } from "../args"

describe("parseDevArgs", () => {
  it("returns default apps when no flags", () => {
    const result = parseDevArgs([])
    expect(result).toEqual({
      mode: "run",
      apps: ["api", "ssr", "desktop"],
      fix: false,
    })
  })

  it("adds scraper with --scraper", () => {
    const result = parseDevArgs(["--scraper"])
    expect(result).toEqual({
      mode: "run",
      apps: ["api", "ssr", "desktop", "scraper"],
      fix: false,
    })
  })

  it("sets fix flag with --fix", () => {
    const result = parseDevArgs(["--fix"])
    expect(result.mode).toBe("run")
    expect(result.fix).toBe(true)
  })

  it("limits apps with --only", () => {
    const result = parseDevArgs(["--only", "api,ssr"])
    expect(result.mode).toBe("run")
    if (result.mode === "run") expect(result.apps).toEqual(["api", "ssr"])
  })

  it("rejects --only combined with --scraper", () => {
    const result = parseDevArgs(["--only", "api", "--scraper"])
    expect(result.mode).toBe("error")
    if (result.mode === "error") expect(result.message).toMatch(/mutually exclusive/)
  })

  it("rejects unknown app names in --only", () => {
    const result = parseDevArgs(["--only", "api,bogus"])
    expect(result.mode).toBe("error")
    if (result.mode === "error") expect(result.message).toMatch(/unknown app/i)
  })

  it("rejects empty --only", () => {
    const result = parseDevArgs(["--only", ""])
    expect(result.mode).toBe("error")
  })

  it("returns help mode with --help", () => {
    const result = parseDevArgs(["--help"])
    expect(result.mode).toBe("help")
  })
})
