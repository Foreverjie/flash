#!/usr/bin/env node
/**
 * Test runner gate: the API test suite is integration tests against a real
 * PostgreSQL. When no database is configured (e.g. CI without secrets),
 * skip cleanly instead of failing at import time.
 */
import "dotenv/config"

import { spawnSync } from "node:child_process"

if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.info("No POSTGRES_URL/DATABASE_URL configured — skipping API integration tests.")
  process.exit(0)
}

const result = spawnSync("pnpm", ["exec", "vitest", "run"], { stdio: "inherit", shell: false })
process.exit(result.status ?? 1)
