// scripts/dev/args.ts
import { parseArgs } from "node:util"

import type { AppName } from "./apps"
import { DEFAULT_APPS } from "./apps"

const KNOWN_APPS = new Set<AppName>(["api", "ssr", "desktop", "scraper"])

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
      if (!KNOWN_APPS.has(name as AppName)) {
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
