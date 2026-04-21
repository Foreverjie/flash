// scripts/dev/preflight/toolchain.ts
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import path from "pathe"

const exec = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../..")

export function compareSemver(a: string, b: string): number {
  const norm = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .slice(0, 3)
      .map((n) => Number.parseInt(n, 10) || 0)
      .concat([0, 0, 0])
      .slice(0, 3)
  const [a1, a2, a3] = norm(a)
  const [b1, b2, b3] = norm(b)
  return a1 - b1 || a2 - b2 || a3 - b3
}

export function satisfiesRange(version: string, range: string): boolean {
  const alternatives = range.split("||").map((s) => s.trim())
  return alternatives.some((alt) => satisfiesSingle(version, alt))
}

function satisfiesSingle(version: string, expr: string): boolean {
  if (expr.startsWith(">=")) {
    return compareSemver(version, expr.slice(2).trim()) >= 0
  }
  if (expr.startsWith("^")) {
    const base = expr.slice(1).trim()
    const [baseMajor] = base.split(".").map((n) => Number.parseInt(n, 10))
    const [verMajor] = version
      .replace(/^v/, "")
      .split(".")
      .map((n) => Number.parseInt(n, 10))
    return verMajor === baseMajor && compareSemver(version, base) >= 0
  }
  return compareSemver(version, expr) === 0
}

export type CheckResult = { ok: boolean; label: string; detail: string; fix?: string }

export async function checkNode(requiredRange: string): Promise<CheckResult> {
  const { version } = process
  const ok = satisfiesRange(version, requiredRange)
  return {
    ok,
    label: "node",
    detail: ok
      ? `${version} satisfies ${requiredRange}`
      : `${version} does not satisfy ${requiredRange}`,
  }
}

export async function checkPnpm(expected: string): Promise<CheckResult> {
  try {
    const { stdout } = await exec("pnpm", ["--version"])
    const actual = stdout.trim()
    const ok = actual === expected
    return {
      ok,
      label: "pnpm",
      detail: ok ? `${actual} matches packageManager` : `expected ${expected}, got ${actual}`,
      fix: ok ? undefined : `corepack prepare pnpm@${expected} --activate`,
    }
  } catch (err) {
    return {
      ok: false,
      label: "pnpm",
      detail: `not found: ${(err as Error).message}`,
      fix: "Install pnpm: https://pnpm.io/installation",
    }
  }
}

export async function checkPython(requiredMajorMinor: string): Promise<CheckResult> {
  try {
    const { stdout } = await exec("python3", ["--version"])
    const actual = stdout.trim().replace(/^Python\s+/, "")
    const ok = compareSemver(actual, `${requiredMajorMinor}.0`) >= 0
    return {
      ok,
      label: "python",
      detail: ok
        ? `${actual} satisfies >=${requiredMajorMinor}`
        : `${actual} < ${requiredMajorMinor}`,
    }
  } catch (err) {
    return {
      ok: false,
      label: "python",
      detail: `python3 not found: ${(err as Error).message}`,
      fix: "Install Python 3.11+: https://www.python.org/downloads/",
    }
  }
}

export async function checkScraperDeps(): Promise<CheckResult> {
  try {
    await exec("python3", ["-c", "import uvicorn"])
    return { ok: true, label: "scraper deps", detail: "uvicorn importable" }
  } catch {
    return {
      ok: false,
      label: "scraper deps",
      detail: "uvicorn not importable",
      fix: "cd apps/scraper && pip install -r requirements.txt",
    }
  }
}

export async function readRootEngines(fallback: string): Promise<string> {
  const raw = await readFile(path.join(repoRoot, "package.json"), "utf8")
  const pkg = JSON.parse(raw) as { engines?: { node?: string } }
  return pkg.engines?.node ?? fallback
}

export async function readPnpmVersion(): Promise<string> {
  const raw = await readFile(path.join(repoRoot, "package.json"), "utf8")
  const pkg = JSON.parse(raw) as { packageManager?: string }
  const pm = pkg.packageManager ?? ""
  const match = pm.match(/^pnpm@(.+)$/)
  if (!match) throw new Error(`packageManager field not pnpm@<version>: ${pm}`)
  return match[1]
}
