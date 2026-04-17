# Unified Dev Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command — `pnpm dev` — that preflight-checks toolchain/`.env`/ports, then orchestrates `apps/api`, `apps/ssr`, `apps/desktop` (web), and optionally `apps/scraper`.

**Architecture:** A custom `tsx` script at `scripts/dev.ts` drives two sequential phases. Phase 1 (preflight) runs four pure-logic check modules (toolchain, env, ports) and renders a consolidated report. Phase 2 (spawn) launches each selected app as a child process with a prefixed-line log stream, and a single shared `shuttingDown` flag plus shared-children list handles graceful teardown on `SIGINT` / fail-fast on any child crash.

**Tech Stack:** Node built-ins (`node:util`, `node:child_process`, `node:net`, `node:fs/promises`), `tsx` (already a devDep), `chalk@4.1.2` (already present transitively — promoted to a direct devDep), `vitest` for unit tests.

**Spec:** `docs/superpowers/specs/2026-04-17-dev-orchestration-design.md`

---

## File Structure

| File                                      | Action | Responsibility                                                         |
| ----------------------------------------- | ------ | ---------------------------------------------------------------------- |
| `package.json`                            | Modify | Add `engines.node`, `scripts.dev`, `devDependencies.chalk`             |
| `scripts/dev.ts`                          | Create | Entry point — parses args, runs preflight, spawns apps, wires shutdown |
| `scripts/dev/apps.ts`                     | Create | `AppSpec` type + registry of all four apps (cmd, cwd, port, color)     |
| `scripts/dev/args.ts`                     | Create | `util.parseArgs` wrapper, validates `--scraper` vs `--only`, `--help`  |
| `scripts/dev/preflight/index.ts`          | Create | Orchestrates all checks, renders report, returns pass/fail             |
| `scripts/dev/preflight/toolchain.ts`      | Create | Node / pnpm / Python / scraper-deps checks                             |
| `scripts/dev/preflight/env.ts`            | Create | `.env` parity check vs `.env.example`; `--fix` copies/appends          |
| `scripts/dev/preflight/ports.ts`          | Create | TCP probe + `lsof` PID lookup; `--fix` sends TERM then KILL            |
| `scripts/dev/spawn.ts`                    | Create | `child_process.spawn` wrapper with prefixed per-line streaming         |
| `scripts/dev/shutdown.ts`                 | Create | Shared `shuttingDown` flag, signal handlers, graceful teardown         |
| `scripts/dev/__tests__/args.test.ts`      | Create | Flag parsing edge cases                                                |
| `scripts/dev/__tests__/env.test.ts`       | Create | `.env` parity and `--fix` behavior                                     |
| `scripts/dev/__tests__/toolchain.test.ts` | Create | Version comparison logic                                               |
| `scripts/dev/__tests__/ports.test.ts`     | Create | TCP probe with ephemeral server                                        |
| `CLAUDE.md`                               | Modify | Document the new `pnpm dev` command under the Commands section         |

**Testing discipline.** Every pure-logic module (`args`, `env`, `toolchain`, `ports`) is TDD — red test first, minimal impl, green. Glue modules (`apps`, `preflight/index`, `spawn`, `shutdown`, `dev`) have no unit tests per the spec (orchestrator integration is flaky to test and the per-module tests already cover the logic). Those modules are verified by the manual smoke test in Task 12.

---

### Task 1: Root `package.json` changes

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Read current root `package.json`**

Run: `cat package.json`
Expected: existing file with `scripts`, `devDependencies` blocks and no `engines`.

- [ ] **Step 2: Add `engines.node`, `dev` script, and direct `chalk` dep**

Make three edits to `package.json`:

Add a top-level `engines` block after the `packageManager` field:

```json
  "packageManager": "pnpm@10.17.0",
  "engines": {
    "node": "^20.19.0 || >=22.12.0"
  },
```

Add `"dev"` as the first script (keeps the list roughly alphabetical, but `dev` is the primary entry point so put it first):

```json
  "scripts": {
    "dev": "tsx scripts/dev.ts",
    "build:packages": "turbo run build --filter=\"./packages/**/*\"",
```

Add `chalk` to `devDependencies` (alphabetical position between `@vercel/node` and `cross-env`):

```json
    "@vercel/node": "5.5.4",
    "chalk": "4.1.2",
    "cross-env": "10.1.0",
```

- [ ] **Step 3: Install the new direct dep**

Run: `pnpm install`
Expected: success, `chalk` appears in `node_modules/chalk` (already resolvable; `pnpm install` just records the direct edge).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(root): pin Node engine, add dev script, promote chalk to direct devDep"
```

---

### Task 2: `AppSpec` registry

**Files:**

- Create: `scripts/dev/apps.ts`

No test file — pure data. Consumed by tested modules, which implicitly cover it.

- [ ] **Step 1: Create the registry**

```typescript
// scripts/dev/apps.ts
import { fileURLToPath } from "node:url"
import path from "pathe"

const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")

export type AppName = "api" | "ssr" | "desktop" | "scraper"

export type AppSpec = {
  name: AppName
  cwd: string
  cmd: string
  args: string[]
  color: "cyan" | "magenta" | "green" | "yellow"
  port: number
  envExample?: string // absolute path, if one exists
}

export const APPS: Record<AppName, AppSpec> = {
  api: {
    name: "api",
    cwd: path.join(repoRoot, "apps/api"),
    cmd: "pnpm",
    args: ["run", "dev"],
    color: "cyan",
    port: 3001,
    envExample: path.join(repoRoot, "apps/api/.env.example"),
  },
  ssr: {
    name: "ssr",
    cwd: path.join(repoRoot, "apps/ssr"),
    cmd: "pnpm",
    args: ["run", "dev"],
    color: "magenta",
    port: 2234,
  },
  desktop: {
    name: "desktop",
    cwd: path.join(repoRoot, "apps/desktop"),
    cmd: "pnpm",
    args: ["run", "dev:web"],
    color: "green",
    port: 5173,
    envExample: path.join(repoRoot, "apps/desktop/.env.example"),
  },
  scraper: {
    name: "scraper",
    cwd: path.join(repoRoot, "apps/scraper"),
    cmd: "uvicorn",
    args: ["scraper.main:app", "--reload", "--port", "8000"],
    color: "yellow",
    port: 8000,
    envExample: path.join(repoRoot, "apps/scraper/.env.example"),
  },
}

export const DEFAULT_APPS: AppName[] = ["api", "ssr", "desktop"]
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm run typecheck`
Expected: no errors (note: typecheck is Turbo-driven and may skip `scripts/`; that's fine — later tasks compile-time-depend on this file).

- [ ] **Step 3: Commit**

```bash
git add scripts/dev/apps.ts
git commit -m "feat(dev): add AppSpec registry for orchestrator"
```

---

### Task 3: Args parser — test

**Files:**

- Create: `scripts/dev/__tests__/args.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/dev/__tests__/args.test.ts`
Expected: FAIL — `Cannot find module '../args'`.

---

### Task 4: Args parser — implementation

**Files:**

- Create: `scripts/dev/args.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// scripts/dev/args.ts
import { parseArgs } from "node:util"

import type { AppName } from "./apps"
import { DEFAULT_APPS } from "./apps"

const KNOWN_APPS: readonly AppName[] = ["api", "ssr", "desktop", "scraper"]

export type ParsedArgs =
  | { mode: "run"; apps: AppName[]; fix: boolean }
  | { mode: "help" }
  | { mode: "error"; message: string }

export function parseDevArgs(argv: string[]): ParsedArgs {
  let parsed
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        scraper: { type: "boolean", default: false },
        fix: { type: "boolean", default: false },
        only: { type: "string" },
        help: { type: "boolean", default: false },
      },
      strict: true,
      allowPositionals: false,
    })
  } catch (err) {
    return { mode: "error", message: err instanceof Error ? err.message : String(err) }
  }

  const { values } = parsed

  if (values.help) return { mode: "help" }

  if (values.only !== undefined && values.scraper) {
    return { mode: "error", message: "--only and --scraper are mutually exclusive" }
  }

  let apps: AppName[]
  if (values.only !== undefined) {
    const requested = values.only
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (requested.length === 0) {
      return { mode: "error", message: "--only cannot be empty" }
    }
    for (const name of requested) {
      if (!KNOWN_APPS.includes(name as AppName)) {
        return { mode: "error", message: `unknown app in --only: ${name}` }
      }
    }
    apps = requested as AppName[]
  } else {
    apps = [...DEFAULT_APPS]
    if (values.scraper) apps.push("scraper")
  }

  return { mode: "run", apps, fix: Boolean(values.fix) }
}

export const HELP_TEXT = `Usage: pnpm dev [flags]

Starts the local dev stack with preflight checks.

Flags:
  --scraper         Include apps/scraper (Python, requires Python 3.11+)
  --fix             Auto-resolve preflight issues (copy .env, kill stale ports)
  --only <list>     Comma-separated apps to run (mutually exclusive with --scraper)
                    Valid names: api, ssr, desktop, scraper
  --help            Show this help and exit

Examples:
  pnpm dev                    # api + ssr + desktop (web)
  pnpm dev --scraper          # + scraper
  pnpm dev --fix              # auto-fix preflight issues
  pnpm dev --only api,ssr     # just these two
`
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm vitest run scripts/dev/__tests__/args.test.ts`
Expected: all 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev/args.ts scripts/dev/__tests__/args.test.ts
git commit -m "feat(dev): add CLI flag parser"
```

---

### Task 5: `.env` parity check — test

**Files:**

- Create: `scripts/dev/__tests__/env.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/dev/__tests__/env.test.ts`
Expected: FAIL — `Cannot find module '../preflight/env'`.

---

### Task 6: `.env` parity check — implementation

**Files:**

- Create: `scripts/dev/preflight/env.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// scripts/dev/preflight/env.ts
import fs from "node:fs/promises"

export function parseEnvKeys(content: string): string[] {
  const keys: string[] = []
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (key) keys.push(key)
  }
  return keys
}

export type ParityResult =
  | { ok: true }
  | { ok: false; reason: "missing-env" }
  | { ok: false; reason: "missing-keys"; keys: string[] }

export async function checkEnvParity(opts: {
  envExample: string
  envPath: string
}): Promise<ParityResult> {
  const exampleContent = await fs.readFile(opts.envExample, "utf8")
  const exampleKeys = parseEnvKeys(exampleContent)

  let envContent: string
  try {
    envContent = await fs.readFile(opts.envPath, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, reason: "missing-env" }
    }
    throw err
  }

  const envKeys = new Set(parseEnvKeys(envContent))
  const missing = exampleKeys.filter((k) => !envKeys.has(k))
  if (missing.length > 0) {
    return { ok: false, reason: "missing-keys", keys: missing }
  }
  return { ok: true }
}

export type FixAction =
  | { envExample: string; envPath: string; action: "copy" }
  | { envExample: string; envPath: string; action: "append"; missingKeys: string[] }

export async function fixEnvFile(action: FixAction): Promise<void> {
  if (action.action === "copy") {
    await fs.copyFile(action.envExample, action.envPath)
    return
  }

  // append: read example, find lines for missing keys, append them
  const exampleContent = await fs.readFile(action.envExample, "utf8")
  const missingSet = new Set(action.missingKeys)
  const linesToAppend: string[] = []
  for (const rawLine of exampleContent.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (missingSet.has(key)) linesToAppend.push(rawLine)
  }

  const existing = await fs.readFile(action.envPath, "utf8")
  const separator = existing.endsWith("\n") ? "" : "\n"
  const appendix = linesToAppend.join("\n") + "\n"
  await fs.writeFile(action.envPath, existing + separator + appendix)
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm vitest run scripts/dev/__tests__/env.test.ts`
Expected: all 9 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev/preflight/env.ts scripts/dev/__tests__/env.test.ts
git commit -m "feat(dev): add .env parity preflight check"
```

---

### Task 7: Toolchain check — test

**Files:**

- Create: `scripts/dev/__tests__/toolchain.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/dev/__tests__/toolchain.test.ts`
Expected: FAIL — `Cannot find module '../preflight/toolchain'`.

---

### Task 8: Toolchain check — implementation

**Files:**

- Create: `scripts/dev/preflight/toolchain.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// scripts/dev/preflight/toolchain.ts
import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"
import path from "pathe"
import { fileURLToPath } from "node:url"

const exec = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../../..")

export function compareSemver(a: string, b: string): number {
  const norm = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .slice(0, 3)
      .map((n) => parseInt(n, 10) || 0)
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
    const [baseMajor] = base.split(".").map((n) => parseInt(n, 10))
    const [verMajor] = version
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10))
    return verMajor === baseMajor && compareSemver(version, base) >= 0
  }
  return compareSemver(version, expr) === 0
}

export type CheckResult = { ok: boolean; label: string; detail: string; fix?: string }

export async function checkNode(requiredRange: string): Promise<CheckResult> {
  const version = process.version
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
      fix: ok ? undefined : "Run `corepack prepare pnpm@" + expected + " --activate`",
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
    const ok = compareSemver(actual, requiredMajorMinor + ".0") >= 0
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
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm vitest run scripts/dev/__tests__/toolchain.test.ts`
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev/preflight/toolchain.ts scripts/dev/__tests__/toolchain.test.ts
git commit -m "feat(dev): add toolchain version preflight checks"
```

---

### Task 9: Ports check — test

**Files:**

- Create: `scripts/dev/__tests__/ports.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/dev/__tests__/ports.test.ts
import net from "node:net"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { probePort } from "../preflight/ports"

let server: net.Server | null = null
let port = 0

beforeEach(async () => {
  server = net.createServer()
  await new Promise<void>((resolve) => {
    server!.listen(0, "127.0.0.1", () => {
      port = (server!.address() as net.AddressInfo).port
      resolve()
    })
  })
})

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = null
  }
})

describe("probePort", () => {
  it("reports occupied port as false", async () => {
    const result = await probePort(port)
    expect(result.free).toBe(false)
  })

  it("reports port as free after server closes", async () => {
    await new Promise<void>((resolve) => server!.close(() => resolve()))
    server = null
    const result = await probePort(port)
    expect(result.free).toBe(true)
  })

  it("reports free for a plausibly-unused high port", async () => {
    // 65500-ish — unlikely to be bound. If flaky, we'll revisit.
    const result = await probePort(65533)
    expect(result.free).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/dev/__tests__/ports.test.ts`
Expected: FAIL — `Cannot find module '../preflight/ports'`.

---

### Task 10: Ports check — implementation

**Files:**

- Create: `scripts/dev/preflight/ports.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// scripts/dev/preflight/ports.ts
import { execFile } from "node:child_process"
import net from "node:net"
import { promisify } from "node:util"

const exec = promisify(execFile)

export type ProbeResult = { free: true } | { free: false; pid?: number; command?: string }

export async function probePort(port: number): Promise<ProbeResult> {
  const bindResult = await new Promise<"free" | "occupied">((resolve) => {
    const server = net.createServer()
    server.once("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        resolve("occupied")
      } else {
        resolve("occupied")
      }
    })
    server.once("listening", () => {
      server.close(() => resolve("free"))
    })
    server.listen(port, "127.0.0.1")
  })

  if (bindResult === "free") return { free: true }

  // Try to identify the occupant
  try {
    const { stdout: pidOut } = await exec("lsof", ["-i", `:${port}`, "-sTCP:LISTEN", "-t"])
    const pid = parseInt(pidOut.trim().split("\n")[0], 10)
    if (!pid) return { free: false }
    try {
      const { stdout: cmdOut } = await exec("ps", ["-p", String(pid), "-o", "comm="])
      return { free: false, pid, command: cmdOut.trim() }
    } catch {
      return { free: false, pid }
    }
  } catch {
    return { free: false }
  }
}

export async function killOccupant(pid: number, graceMs = 2000): Promise<boolean> {
  if (pid === 1 || pid === process.pid) return false
  try {
    process.kill(pid, "SIGTERM")
  } catch {
    return true // already dead
  }

  const deadline = Date.now() + graceMs
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return true // gone
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  try {
    process.kill(pid, "SIGKILL")
  } catch {
    /* already gone */
  }
  return true
}
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `pnpm vitest run scripts/dev/__tests__/ports.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev/preflight/ports.ts scripts/dev/__tests__/ports.test.ts
git commit -m "feat(dev): add port probe + occupant kill"
```

---

### Task 11: Preflight orchestrator

**Files:**

- Create: `scripts/dev/preflight/index.ts`

No test file — this is glue that composes tested modules and formats output.

- [ ] **Step 1: Write the orchestrator**

```typescript
// scripts/dev/preflight/index.ts
import chalk from "chalk"
import path from "pathe"

import type { AppName } from "../apps"
import { APPS } from "../apps"
import { checkEnvParity, fixEnvFile } from "./env"
import {
  checkNode,
  checkPnpm,
  checkPython,
  checkScraperDeps,
  readPnpmVersion,
  readRootEngines,
} from "./toolchain"
import { killOccupant, probePort } from "./ports"

const NODE_FALLBACK = "^20.19.0 || >=22.12.0"

type Row = { ok: boolean; label: string; detail: string; fix?: string }

export async function runPreflight(selected: AppName[], autoFix: boolean): Promise<boolean> {
  console.log(chalk.bold("\nPreflight\n"))

  const toolchain = await runToolchain(selected)
  printSection("Toolchain", toolchain)

  const env = await runEnv(selected, autoFix)
  printSection(".env parity", env)

  const ports = await runPorts(selected, autoFix)
  printSection("Ports", ports)

  const all = [...toolchain, ...env, ...ports]
  const passed = all.filter((r) => r.ok).length
  const failed = all.length - passed

  console.log(chalk.gray("─".repeat(40)))
  if (failed === 0) {
    console.log(chalk.green(`✓ ${passed} passed`))
  } else {
    console.log(chalk.red(`✗ ${failed} failed`) + chalk.gray(`, ${passed} passed`))
    if (!autoFix) console.log(chalk.gray("\nRun with --fix to auto-resolve."))
  }
  console.log("")
  return failed === 0
}

function printSection(title: string, rows: Row[]): void {
  console.log(chalk.bold(title))
  for (const r of rows) {
    const mark = r.ok ? chalk.green("✓") : chalk.red("✗")
    console.log(`  ${mark} ${r.label} — ${r.detail}`)
    if (!r.ok && r.fix) console.log(chalk.gray(`    fix: ${r.fix}`))
  }
  console.log("")
}

async function runToolchain(selected: AppName[]): Promise<Row[]> {
  const rows: Row[] = []
  const nodeRange = await readRootEngines(NODE_FALLBACK)
  rows.push(await checkNode(nodeRange))
  const pnpmVersion = await readPnpmVersion()
  rows.push(await checkPnpm(pnpmVersion))
  if (selected.includes("scraper")) {
    rows.push(await checkPython("3.11"))
    rows.push(await checkScraperDeps())
  }
  return rows
}

async function runEnv(selected: AppName[], autoFix: boolean): Promise<Row[]> {
  const rows: Row[] = []
  for (const name of selected) {
    const app = APPS[name]
    if (!app.envExample) {
      rows.push({ ok: true, label: name, detail: "no .env.example (skipped)" })
      continue
    }
    const envPath = path.join(app.cwd, ".env")
    const result = await checkEnvParity({ envExample: app.envExample, envPath })
    if (result.ok) {
      rows.push({ ok: true, label: name, detail: `${path.relative(app.cwd, envPath)} in sync` })
      continue
    }
    if (result.reason === "missing-env") {
      if (autoFix) {
        await fixEnvFile({ envExample: app.envExample, envPath, action: "copy" })
        rows.push({
          ok: true,
          label: name,
          detail: `copied .env.example → .env (fill in secrets before first real use)`,
        })
      } else {
        rows.push({
          ok: false,
          label: name,
          detail: `.env missing`,
          fix: `cp ${path.relative(process.cwd(), app.envExample)} ${path.relative(process.cwd(), envPath)}`,
        })
      }
      continue
    }
    // missing-keys
    if (autoFix) {
      await fixEnvFile({
        envExample: app.envExample,
        envPath,
        action: "append",
        missingKeys: result.keys,
      })
      rows.push({
        ok: true,
        label: name,
        detail: `appended ${result.keys.length} key(s): ${result.keys.join(", ")} (values may be placeholders)`,
      })
    } else {
      rows.push({
        ok: false,
        label: name,
        detail: `missing keys: ${result.keys.join(", ")}`,
        fix: `add the keys above, or run with --fix`,
      })
    }
  }
  return rows
}

async function runPorts(selected: AppName[], autoFix: boolean): Promise<Row[]> {
  const rows: Row[] = []
  for (const name of selected) {
    const app = APPS[name]
    const probe = await probePort(app.port)
    if (probe.free) {
      rows.push({ ok: true, label: `${app.port} (${name})`, detail: "free" })
      continue
    }
    const occupantStr = probe.pid
      ? `pid ${probe.pid}${probe.command ? ` (${probe.command})` : ""}`
      : "unknown occupant"
    if (autoFix && probe.pid) {
      await killOccupant(probe.pid)
      const recheck = await probePort(app.port)
      if (recheck.free) {
        rows.push({ ok: true, label: `${app.port} (${name})`, detail: `killed ${occupantStr}` })
      } else {
        rows.push({
          ok: false,
          label: `${app.port} (${name})`,
          detail: `still occupied after kill`,
        })
      }
    } else {
      rows.push({
        ok: false,
        label: `${app.port} (${name})`,
        detail: `in use by ${occupantStr}`,
        fix: probe.pid ? `kill ${probe.pid}, or run with --fix` : "investigate the occupant",
      })
    }
  }
  return rows
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm vitest run scripts/dev/__tests__/ --run`
Expected: all prior tests still PASS (this file isn't tested, but shouldn't break anything).

- [ ] **Step 3: Commit**

```bash
git add scripts/dev/preflight/index.ts
git commit -m "feat(dev): add preflight orchestrator and report renderer"
```

---

### Task 12: Spawn module

**Files:**

- Create: `scripts/dev/spawn.ts`

- [ ] **Step 1: Write the spawn wrapper**

```typescript
// scripts/dev/spawn.ts
import type { ChildProcess } from "node:child_process"
import { spawn } from "node:child_process"

import chalk from "chalk"

import type { AppSpec } from "./apps"

export type RunningApp = {
  spec: AppSpec
  child: ChildProcess
  exited: Promise<number | null> // resolves with exit code (null if signaled)
}

export function spawnApp(spec: AppSpec, prefixWidth: number): RunningApp {
  const child = spawn(spec.cmd, spec.args, {
    cwd: spec.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  })

  const colorize = chalk[spec.color]
  const prefix = colorize(`[${spec.name}]`.padEnd(prefixWidth + 2))
  const errPrefix = colorize.underline(`[${spec.name}]`.padEnd(prefixWidth + 2))

  streamLines(child.stdout!, (line) => process.stdout.write(`${prefix} ${line}\n`))
  streamLines(child.stderr!, (line) => process.stderr.write(`${errPrefix} ${line}\n`))

  const exited = new Promise<number | null>((resolve) => {
    child.once("exit", (code) => resolve(code))
  })

  return { spec, child, exited }
}

function streamLines(stream: NodeJS.ReadableStream, onLine: (line: string) => void): void {
  let buf = ""
  stream.setEncoding("utf8")
  stream.on("data", (chunk: string) => {
    buf += chunk
    let idx: number
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).replace(/\r$/, "")
      buf = buf.slice(idx + 1)
      onLine(line)
    }
  })
  stream.on("end", () => {
    if (buf.length > 0) onLine(buf)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/dev/spawn.ts
git commit -m "feat(dev): add child-process spawn with prefixed line streaming"
```

---

### Task 13: Shutdown module

**Files:**

- Create: `scripts/dev/shutdown.ts`

- [ ] **Step 1: Write the shutdown coordinator**

```typescript
// scripts/dev/shutdown.ts
import chalk from "chalk"

import type { RunningApp } from "./spawn"

const GRACE_MS = 5000

export class ShutdownCoordinator {
  private shuttingDown = false
  private firstFailureCode: number | null = null

  constructor(private apps: RunningApp[]) {}

  install(): void {
    process.once("SIGINT", () => this.initiate("SIGINT"))
    process.once("SIGTERM", () => this.initiate("SIGTERM"))

    for (const app of this.apps) {
      app.exited.then((code) => {
        if (this.shuttingDown) return
        // A child exited unexpectedly → fail-fast
        console.error(
          chalk.red(
            `\n[dev] ${app.spec.name} exited with code ${code ?? "null"} — shutting down\n`,
          ),
        )
        if (code !== null && code !== 0 && this.firstFailureCode === null) {
          this.firstFailureCode = code
        } else if (code === null && this.firstFailureCode === null) {
          this.firstFailureCode = 1
        }
        this.initiate("child-exit")
      })
    }
  }

  async wait(): Promise<number> {
    await Promise.all(this.apps.map((a) => a.exited))
    return this.firstFailureCode ?? 0
  }

  private initiate(reason: string): void {
    if (this.shuttingDown) return
    this.shuttingDown = true
    if (reason === "SIGINT" || reason === "SIGTERM") {
      console.log(chalk.gray(`\n[dev] received ${reason}, stopping all apps...`))
    }

    for (const app of this.apps) {
      if (app.child.exitCode === null && app.child.signalCode === null) {
        try {
          app.child.kill("SIGTERM")
        } catch {
          /* already dead */
        }
      }
    }

    setTimeout(() => {
      for (const app of this.apps) {
        if (app.child.exitCode === null && app.child.signalCode === null) {
          console.log(chalk.gray(`[dev] force-killing ${app.spec.name}`))
          try {
            app.child.kill("SIGKILL")
          } catch {
            /* already dead */
          }
        }
      }
    }, GRACE_MS).unref()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/dev/shutdown.ts
git commit -m "feat(dev): add graceful shutdown coordinator"
```

---

### Task 14: Main entry

**Files:**

- Create: `scripts/dev.ts`

- [ ] **Step 1: Write the entry script**

```typescript
// scripts/dev.ts
import chalk from "chalk"

import { APPS, type AppName } from "./dev/apps"
import { HELP_TEXT, parseDevArgs } from "./dev/args"
import { runPreflight } from "./dev/preflight/index"
import { ShutdownCoordinator } from "./dev/shutdown"
import { spawnApp } from "./dev/spawn"

async function main(): Promise<void> {
  const parsed = parseDevArgs(process.argv.slice(2))

  if (parsed.mode === "help") {
    console.log(HELP_TEXT)
    process.exit(0)
  }
  if (parsed.mode === "error") {
    console.error(chalk.red(`error: ${parsed.message}`))
    console.error(`\n${HELP_TEXT}`)
    process.exit(2)
  }

  const { apps, fix } = parsed

  const ok = await runPreflight(apps, fix)
  if (!ok) process.exit(1)

  const prefixWidth = apps.reduce((max, n) => Math.max(max, n.length), 0)
  const running = apps.map((name: AppName) => spawnApp(APPS[name], prefixWidth))

  console.log(chalk.bold(`Starting ${apps.length} app(s): ${apps.join(", ")}\n`))

  const coordinator = new ShutdownCoordinator(running)
  coordinator.install()

  const exitCode = await coordinator.wait()
  process.exit(exitCode)
}

main().catch((err) => {
  console.error(chalk.red("[dev] fatal:"), err)
  process.exit(1)
})
```

- [ ] **Step 2: Smoke test — help**

Run: `pnpm dev --help`
Expected: prints help text, exits 0.

- [ ] **Step 3: Smoke test — usage error**

Run: `pnpm dev --only api --scraper`
Expected: prints `error: --only and --scraper are mutually exclusive`, exits 2.

- [ ] **Step 4: Commit**

```bash
git add scripts/dev.ts
git commit -m "feat(dev): wire up unified pnpm dev entry point"
```

---

### Task 15: Document in CLAUDE.md

**Files:**

- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the unified dev section under Commands**

Find the existing `## Commands` section block that starts with:

```
# Development
cd apps/desktop && pnpm run dev:web   # Desktop renderer in browser (recommended)
```

Insert a new sub-section **before** the existing `# Development` comment:

```markdown
# Unified dev (recommended)

pnpm dev # api + ssr + desktop (web)
pnpm dev --scraper # + Python scraper
pnpm dev --fix # auto-resolve preflight (.env, stale ports)
pnpm dev --only api,ssr # exact subset (mutually exclusive with --scraper)

# Development (per-app — still works)
```

Also change the existing comment `# Development` to `# Development (per-app — still works)` so the relationship is clear.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): document pnpm dev unified orchestrator"
```

---

### Task 16: Full manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Full test suite still passes**

Run: `pnpm run test`
Expected: all tests PASS (no regressions in existing suites).

- [ ] **Step 2: Typecheck passes**

Run: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint passes**

Run: `pnpm run lint:fix`
Expected: no errors.

- [ ] **Step 4: `pnpm dev --help` works**

Run: `pnpm dev --help`
Expected: usage text, exit 0.

- [ ] **Step 5: Preflight catches a missing `.env`**

Setup: temporarily rename one app's `.env` out of the way (e.g. `mv apps/api/.env apps/api/.env.bak`).
Run: `pnpm dev`
Expected: preflight fails with a `.env missing` row and suggests `--fix`. Exit 1.
Cleanup: `mv apps/api/.env.bak apps/api/.env`.

- [ ] **Step 6: `--fix` copies the missing `.env`**

Setup: `mv apps/api/.env apps/api/.env.bak`
Run: `pnpm dev --fix`
Expected: preflight reports `copied .env.example → .env`; then apps start spawning (Ctrl-C to stop).
Cleanup: restore original `.env`.

- [ ] **Step 7: Preflight catches an occupied port**

Setup: in another terminal, run `python3 -m http.server 3001` to occupy port 3001.
Run: `pnpm dev`
Expected: preflight fails with `3001 (api) in use by pid <X> (python3.11)`. Exit 1.
Cleanup: stop the `http.server` process.

- [ ] **Step 8: `--fix` kills the occupant and retries**

Setup: same as step 7 (occupy 3001 with `python3 -m http.server 3001 &`).
Run: `pnpm dev --fix`
Expected: preflight reports `killed pid <X> (python3.11)`; apps start.
Stop with Ctrl-C and verify all children exit within 5s.

- [ ] **Step 9: Happy path — all defaults start cleanly**

Run: `pnpm dev`
Expected:

- Preflight section prints all ✓
- Each app's prefixed startup output appears (`[api] listening on ...`, `[ssr] ready on 2234`, `[desktop] VITE v7 ready ...`)
- Opening `http://localhost:5173` in the browser loads the web app.
- Ctrl-C shuts down all three within 5 seconds, exit 0.

- [ ] **Step 10: `--scraper` path (if local Python env is set up)**

Preconditions: `apps/scraper/.env` exists with a valid `INTERNAL_API_KEY`; Python 3.11+ installed; scraper deps installed (`cd apps/scraper && pip install -r requirements.txt`).
Run: `pnpm dev --scraper`
Expected: Python + scraper-deps rows appear in toolchain check; `[scraper] Uvicorn running on http://0.0.0.0:8000` appears.
If scraper deps missing, preflight should fail with the exact `pip install` fix hint.

- [ ] **Step 11: Final commit**

No code changes expected. If the smoke test surfaced anything (e.g. a log-prefix glitch on Windows CRLF), fix it in a small commit now. Otherwise skip.

---

## Completion criteria

All 16 tasks checked, `pnpm run test` / `typecheck` / `lint:fix` green, and the Task 16 smoke test passed end-to-end.
