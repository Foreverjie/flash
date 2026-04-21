// scripts/dev/__tests__/env.test.ts
import fs from "node:fs/promises"
import os from "node:os"

import path from "pathe"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { checkEnvParity, fixEnvFile, parseEnvKeys } from "../preflight/env"

let tmp: string

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "dev-env-"))
})
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true })
})

describe("parseEnvKeys", () => {
  it("parses KEY=VALUE pairs", () => {
    expect(parseEnvKeys("A=1\nB=2")).toEqual(["A", "B"])
  })
  it("ignores comments and blank lines", () => {
    expect(parseEnvKeys("# comment\n\nA=1\n   \nB=2")).toEqual(["A", "B"])
  })
  it("ignores lines without =", () => {
    expect(parseEnvKeys("A=1\ngarbage\nB=2")).toEqual(["A", "B"])
  })
  it("trims whitespace around keys", () => {
    expect(parseEnvKeys("  A =1\nB=2")).toEqual(["A", "B"])
  })
})

describe("checkEnvParity", () => {
  it("reports missing .env as failure", async () => {
    const example = path.join(tmp, ".env.example")
    await fs.writeFile(example, "A=1\nB=2\n")
    const result = await checkEnvParity({ envExample: example, envPath: path.join(tmp, ".env") })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("missing-env")
  })

  it("reports missing keys", async () => {
    await fs.writeFile(path.join(tmp, ".env.example"), "A=1\nB=2\nC=3\n")
    await fs.writeFile(path.join(tmp, ".env"), "A=1\n")
    const result = await checkEnvParity({
      envExample: path.join(tmp, ".env.example"),
      envPath: path.join(tmp, ".env"),
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("missing-keys")
    if (result.reason === "missing-keys") {
      expect(result.keys).toEqual(["B", "C"])
    }
  })

  it("returns ok when parity holds", async () => {
    await fs.writeFile(path.join(tmp, ".env.example"), "A=1\nB=2\n")
    await fs.writeFile(path.join(tmp, ".env"), "A=x\nB=y\n")
    const result = await checkEnvParity({
      envExample: path.join(tmp, ".env.example"),
      envPath: path.join(tmp, ".env"),
    })
    expect(result.ok).toBe(true)
  })
})

describe("fixEnvFile", () => {
  it("copies .env.example when .env is missing", async () => {
    await fs.writeFile(path.join(tmp, ".env.example"), "A=1\nB=2\n")
    await fixEnvFile({
      envExample: path.join(tmp, ".env.example"),
      envPath: path.join(tmp, ".env"),
      action: "copy",
    })
    const content = await fs.readFile(path.join(tmp, ".env"), "utf8")
    expect(content).toBe("A=1\nB=2\n")
  })

  it("appends only missing keys when .env exists", async () => {
    await fs.writeFile(path.join(tmp, ".env.example"), "A=1\nB=2\nC=3\n")
    await fs.writeFile(path.join(tmp, ".env"), "A=keep-me\n")
    await fixEnvFile({
      envExample: path.join(tmp, ".env.example"),
      envPath: path.join(tmp, ".env"),
      action: "append",
      missingKeys: ["B", "C"],
    })
    const content = await fs.readFile(path.join(tmp, ".env"), "utf8")
    expect(content).toContain("A=keep-me")
    expect(content).toContain("B=2")
    expect(content).toContain("C=3")
  })
})
