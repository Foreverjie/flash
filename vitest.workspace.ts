import { defineWorkspace } from "vitest/config"

// Canonical Vitest workspace.
//
// Reference only the packages that ship a real vitest config. A broad `apps/*`
// glob pulls in apps whose Vite config runs build-only plugins (e.g. the
// desktop route-builder), which fail at project init and break `vitest` at the
// repo root.
//
// Note: `apps/api` holds DB-backed integration tests. Running `vitest` from the
// repo root executes them directly; without POSTGRES_URL/DATABASE_URL they will
// fail. CI keeps using `pnpm --recursive run test`, where `apps/api`'s own
// runner (`src/scripts/run-tests.mjs`) skips cleanly when no database is set.
export default defineWorkspace(["apps/api", "packages/internal/utils"])
