# Unified Dev Orchestration — Design

**Date:** 2026-04-17
**Author:** Claude + Foreverjie
**Status:** Draft — awaiting approval

## Problem

Starting a full local dev stack today means opening four terminals and remembering four commands: `pnpm --filter=api dev`, `pnpm --filter=ssr dev`, `pnpm --filter=desktop dev:web`, and `uvicorn scraper.main:app` in a Python virtualenv. Each has its own `.env.example` that drifts against `.env`, and its own port that silently collides with stale processes. First-run setup and post-pull re-sync are both error-prone.

## Goals

1. One command — `pnpm dev` — to start the three Node apps; `--scraper` adds the Python service.
2. Fail fast and loud on bad toolchain versions, missing/incomplete `.env` files, and occupied ports.
3. `--fix` as a one-keystroke escape hatch that auto-resolves the common blockers.
4. Clean, readable interleaved output; predictable `Ctrl-C` shutdown.
5. Zero new runtime dependencies; no TUI learning curve.

## Non-goals

- Replacing `turbo`/Vite/tsx hot-reload — each app's existing dev server keeps handling its own watch logic.
- Auto-restart of crashed services — fail-fast is the explicit behavior.
- Supporting the Electron main process (`dev:electron`) — only the `dev:web` renderer is orchestrated; Electron is an outer shell the dev launches manually when needed.
- Supporting the mobile app — Expo's dev server has its own lifecycle.

## Command surface

Entry point: `scripts/dev.ts`, wired into the root `package.json` as `"dev": "tsx scripts/dev.ts"`.

| Invocation                | Result                                      |
| ------------------------- | ------------------------------------------- |
| `pnpm dev`                | api + ssr + desktop(web)                    |
| `pnpm dev --scraper`      | api + ssr + desktop(web) + scraper          |
| `pnpm dev --fix`          | same default set, auto-fix preflight issues |
| `pnpm dev --only api,ssr` | exactly those apps, no defaults             |
| `pnpm dev --help`         | print usage and exit 0                      |

`--only` is mutually exclusive with `--scraper`; combining them is a usage error (exit 2). `--fix` composes with any selection.

Flags parse via Node's built-in `util.parseArgs`. No new dep.

## Architecture

Two sequential phases:

```
┌────────────────┐   pass    ┌────────────────┐
│  Preflight     │──────────▶│  Spawn + wait  │
│  (sync checks) │           │  (parallel)    │
└────────────────┘           └────────────────┘
         │ fail                     │ SIGINT/child-exit
         ▼                          ▼
      exit 1                    teardown + exit
```

Preflight runs to completion (collecting all failures, not short-circuiting on the first) so the user sees the full list in one pass. Spawn only runs if preflight is green.

## Preflight checks

### 1. Toolchain

| Check          | Requirement                                                                                             | Source of truth      |
| -------------- | ------------------------------------------------------------------------------------------------------- | -------------------- |
| Node version   | satisfies `engines.node` from root `package.json`, else `^20.19.0 \|\| >=22.12.0` (Vite 7.1.11's floor) | `process.version`    |
| pnpm version   | exact match of `packageManager` field (`pnpm@10.17.0`)                                                  | `pnpm --version`     |
| Python version | `>=3.11` _(scraper only)_                                                                               | `python3 --version`  |
| Scraper deps   | `python3 -c "import uvicorn"` returns 0 _(scraper only)_                                                | subprocess exit code |

Scraper-only checks are skipped when `--scraper` / `--only` does not include scraper.

On scraper dep failure the report includes the fix command: `cd apps/scraper && pip install -r requirements.txt`.

### 2. `.env` parity

For each selected app that ships a `.env.example`:

- **Missing `.env`** → fail. `--fix`: copy `.env.example` → `.env` and warn _"secrets still need to be filled in"_.
- **Key drift** (key present in `.env.example`, absent in `.env`) → fail. `--fix`: append missing keys with their example values; warn once that values may be placeholders.

Parser is a minimal `KEY=VALUE` line reader — ignores blank lines and `#` comments, does not evaluate shell substitutions, does not validate values. Value content is out of scope (apps fail loudly on startup if a required value is wrong, and that's fine).

Apps and their env files:

| App     | `.env.example` path                 |
| ------- | ----------------------------------- |
| api     | `apps/api/.env.example`             |
| ssr     | `apps/ssr/.env.example` _if exists_ |
| desktop | `apps/desktop/.env.example`         |
| scraper | `apps/scraper/.env.example`         |

If an app lacks a `.env.example`, the check is skipped silently for that app.

### 3. Ports

Ports per app:

| App                  | Port |
| -------------------- | ---- |
| api                  | 3001 |
| ssr                  | 2234 |
| desktop (web / Vite) | 5173 |
| scraper              | 8000 |

Probe: try `net.createServer().listen(port, '127.0.0.1')`; success = free, `EADDRINUSE` = occupied. On occupied, shell out to `lsof -i :<port> -sTCP:LISTEN -t` to read the PID, and `ps -p <pid> -o comm=` to read the command name, for the report.

`--fix` teardown sequence per occupied port:

1. `kill -TERM <pid>` (refuse if pid is 1 or equal to `process.pid`)
2. Poll for process exit, up to 2 seconds
3. `kill -KILL <pid>` if still alive
4. Re-probe the port; fail the check if still occupied

### Report format

One line per check, grouped by section header. Example:

```
Toolchain
  ✓ node 20.19.3 satisfies ^20.19.0 || >=22.12.0
  ✓ pnpm 10.17.0 matches packageManager
.env parity
  ✗ apps/api/.env missing RESEND_API_KEY (present in .env.example)
  ✓ apps/ssr has no .env.example (skipped)
Ports
  ✓ 3001 (api) free
  ✗ 5173 (desktop) in use by pid 4321 (node)

─────────────────────────────
✗ 2 failed, 3 passed

Run with --fix to auto-resolve.
```

Exit code `1` on any failure, `0` on all pass.

## Process orchestration

Each app is a record:

```ts
type AppSpec = {
  name: "api" | "ssr" | "desktop" | "scraper"
  cwd: string // absolute path to apps/<name>
  cmd: string // 'pnpm' | 'uvicorn'
  args: string[]
  color: ChalkColor // stable per app
  port: number // for preflight
}
```

The registry lives in `scripts/dev/apps.ts`. Commands reuse existing dev scripts so the orchestrator is thin:

| App     | Spawn                                                             |
| ------- | ----------------------------------------------------------------- |
| api     | `pnpm run dev` in `apps/api`                                      |
| ssr     | `pnpm run dev` in `apps/ssr`                                      |
| desktop | `pnpm run dev:web` in `apps/desktop`                              |
| scraper | `uvicorn scraper.main:app --reload --port 8000` in `apps/scraper` |

All children spawn with `stdio: ['ignore', 'pipe', 'pipe']` and inherit `process.env` with `FORCE_COLOR=1` added so their own ANSI output survives the prefix transform.

### Output

Each stdout/stderr line is prefixed with a fixed-width, colored tag:

```
[api]     listening on http://localhost:3001
[ssr]     ready on 2234
[desktop] VITE v7 ready in 412 ms  → http://localhost:5173
[scraper] Uvicorn running on http://0.0.0.0:8000
```

Prefix width = longest selected app name. Stable color assignment: api=cyan, ssr=magenta, desktop=green, scraper=yellow. Stderr lines get the same prefix but also underlined, so errors stand out.

### Shutdown

A single `shuttingDown` boolean flag plus a shared list of live children. Triggers that initiate shutdown:

- `SIGINT` (Ctrl-C) — orderly shutdown, exit 0 if all children exit cleanly.
- `SIGTERM` — same as SIGINT.
- Any child process `exit` event observed **while `shuttingDown` is false** — fail-fast: log the offending app prominently, set `shuttingDown = true`, propagate the child's exit code as the final exit code.

Child exits observed **while `shuttingDown` is true** are expected (we just signaled them) and are logged only at debug level — they do not re-trigger the teardown path.

Teardown sequence:

1. Send `SIGTERM` to every live child in parallel.
2. Start a 5-second grace timer.
3. On timer expiry, `SIGKILL` any survivors.
4. Exit with the first non-zero child exit code observed, else 0.

No auto-restart. Vite/tsx/uvicorn each handle their own hot reload internally — if one of them actually crashes hard, the dev wants to see it, not have it silently respawn.

## File layout

```
scripts/dev.ts                          # entry point, ~80 lines
scripts/dev/
  ├── apps.ts                           # AppSpec registry
  ├── args.ts                           # util.parseArgs wrapper, validation
  ├── preflight/
  │   ├── index.ts                      # orchestrates checks, renders report
  │   ├── toolchain.ts                  # node/pnpm/python/scraper-deps checks
  │   ├── env.ts                        # .env parity check + --fix
  │   └── ports.ts                      # TCP probe + lsof + --fix
  ├── spawn.ts                          # child_process wrapper, prefixed streaming
  └── shutdown.ts                       # signal handlers, graceful teardown
scripts/dev/__tests__/
  ├── env.test.ts                       # .env parity edge cases
  ├── toolchain.test.ts                 # version comparison
  └── ports.test.ts                     # probe with ephemeral server
```

Each file stays small and single-purpose.

## Dependencies

Zero new runtime deps. All built-ins (`node:util`, `node:child_process`, `node:net`, `node:fs`) plus existing devDeps (`tsx`, `vitest`). Color output uses `chalk` — add as a direct devDep of the root `package.json` if not already resolvable.

## Testing

Vitest files under `scripts/dev/__tests__/`:

- **`env.test.ts`** — fixtures for missing `.env`, key drift, identical files, empty `.env.example`. Verify the parser handles comments and blank lines.
- **`toolchain.test.ts`** — verify version comparison logic (semver range for node, exact-match for pnpm).
- **`ports.test.ts`** — bind an ephemeral server to a random port and verify the probe correctly reports it occupied, then free after close.

End-to-end orchestrator tests are skipped — spawning real dev servers is flaky and the per-module tests cover the logic that can go wrong.

## Rollout

1. Land `scripts/dev.ts` + modules + tests on a feature branch.
2. Update root `package.json`:
   - Add `"dev": "tsx scripts/dev.ts"` to `scripts`.
   - Add `"engines": { "node": "^20.19.0 || >=22.12.0" }` — matches Vite 7.1.11's floor, which is currently the strictest Node requirement across the selected apps. This becomes the single source of truth the preflight Node check reads.
3. Add a short `## Unified dev server` section to `CLAUDE.md` commands block documenting `pnpm dev`, `--scraper`, `--fix`, `--only`.
4. Open PR. No migration needed — existing per-app `pnpm --filter=... dev` commands keep working.

## Open questions

None. All four design decisions (invocation style A, strict+`--fix` C, custom tsx script B, key-parity `.env` check B) confirmed during brainstorming.
