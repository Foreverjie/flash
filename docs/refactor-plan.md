# Refactoring Plan

> Phase 3 deliverable. Derived from `docs/project-overview.md`, `docs/application-flow.md`, `docs/module-dependency.md`, `docs/refactor-risks.md`, `docs/dead-code-report.md`, `docs/duplicate-code-report.md`. **No code has been changed.**
>
> Execution rule: only P0 may proceed in the next session (Phase 4). P1–P3 are documented here for planning and require explicit approval per task. Every task must preserve business behavior and keep `typecheck` / `lint` / `test` green.

## Baseline to protect (run before and after every change)

```bash
pnpm run typecheck        # 1. types
pnpm run lint:fix         # 2. lint (auto-fix)
pnpm run test             # 3. vitest (recursive)
pnpm run build:web        # 4. build (for P2/P3 or anything touching bundling)
# behavioral net for P1+: Playwright e2e in /e2e (port 2233)
```

Capture the current green state first; a task that can't return to green is reverted, not patched over.

---

## P0 — Low-Risk Cleanup

> Isolated, mechanical, independently revertible. Recommended to execute in the listed order.

### P0-1 — Remove unused dependency `@supabase/supabase-js` from `apps/api`

- **Current problem:** declared dependency with zero imports (Phase 2 D2; confirmed by `depcheck` + grep — no `@supabase/supabase-js` / `createClient` under `apps/api/src`). Postgres is reached via Drizzle only.
- **Files:** `apps/api/package.json`, `pnpm-lock.yaml` (regenerated).
- **Solution:** remove the dependency; run `pnpm install` to update the lock.
- **Benefit:** smaller install surface, clearer intent, faster CI.
- **Risks:** low — a hidden dynamic/string usage (checked: none). Watch for a build/seed script that imports it.
- **Validation:** `pnpm run typecheck` + `cd apps/api && pnpm run test` + `pnpm --filter @follow/api build`.
- **Isolated commit:** Yes.
- **Complexity:** Small.

### P0-2 — Remove non-working duplicate `vitest.workspace.js`

- **Current problem:** identical to `vitest.workspace.ts`, self-labeled `// NOT work`, referenced nowhere; tests run via `pnpm --recursive` (Phase 2 D1).
- **Files:** `vitest.workspace.js` (delete). Leave `vitest.workspace.ts` for P0-3.
- **Solution:** delete the `.js` duplicate.
- **Benefit:** removes contradictory config; one less "which file is real?" trap.
- **Risks:** very low. Confirm no CI/script invokes `vitest.workspace.js` by path (grep found none).
- **Validation:** `pnpm run test` produces the same results as baseline.
- **Isolated commit:** Yes.
- **Complexity:** Small.

### P0-3 — Decide the fate of `vitest.workspace.ts` (make-it-work OR delete)

- **Current problem:** also labeled `// NOT work`; Vitest may auto-discover it by filename, creating ambiguity with the recursive test runner.
- **Files:** `vitest.workspace.ts`, root `package.json` `test` script.
- **Solution:** **decision task, not mechanical.** Either (a) delete it and rely on `pnpm --recursive run test`, or (b) make it the canonical runner. Recommend (a) unless there's intent to unify test runs.
- **Benefit:** single, unambiguous test entry point.
- **Risks:** low; changing the test entry could alter which suites run — verify suite count is unchanged.
- **Validation:** compare `pnpm run test` output (suite/test counts) before and after.
- **Isolated commit:** Yes.
- **Complexity:** Small.
- **Blocked by:** confirm decision (a) vs (b) with the maintainer.

### P0-4 — Declare `msw` and `pathe` explicitly in `apps/api`

- **Current problem:** used in `apps/api` source/tests but not declared; resolve only via workspace hoisting (Phase 2, correctness note).
- **Files:** `apps/api/package.json` (+ lock).
- **Solution:** add `msw` (devDependency) and `pathe` (dependency) at the versions already resolved in the lock.
- **Benefit:** removes a latent breakage if hoisting changes; honest dependency graph.
- **Risks:** low; ensure versions match the hoisted ones to avoid a second copy.
- **Validation:** `pnpm run typecheck` + `cd apps/api && pnpm run test`.
- **Isolated commit:** Yes.
- **Complexity:** Small.

### P0-5 — Remove deprecated `CommandButton` (only after import check)

- **Current problem:** deprecated component, no external references (Phase 2 D4) — superseded by `AnimatedCommandButton`.
- **Files:** `apps/desktop/layer/renderer/src/modules/command/command-button.tsx` (+ any barrel that re-exports it).
- **Solution:** confirm no barrel/`index` re-export leaks `CommandButton`, then remove the deprecated export (and `CommandButtonProps` if unused).
- **Benefit:** less dead surface in a large module.
- **Risks:** Low–Medium — a re-export could hide a consumer. Do the barrel grep first.
- **Validation:** `pnpm run typecheck` + `pnpm run build:web`.
- **Isolated commit:** Yes.
- **Complexity:** Small.

### P0-6 — Prune commented-out code blocks (file-by-file, read-first)

- **Current problem:** ~58 TODO/FIXME markers and commented-out blocks across ~14 files (Phase 2 D8).
- **Files:** e.g. `constants/ui.ts`, `components/common/SharePanel.tsx`, `lib/observe-resize.ts`, `modules/feed/feed-icon.tsx`, `modules/command/registry/registry.ts`, `store/utils/helper.ts` (full list in D8).
- **Solution:** remove only comment blocks that are clearly obsolete code (not documentation, not intentionally-disabled logic). One file per commit; read each block before deleting.
- **Benefit:** readability; less confusion about what's live.
- **Risks:** Low, but a "disabled on purpose" block could be re-enabled later — when in doubt, leave it.
- **Validation:** `pnpm run lint` + `pnpm run typecheck`.
- **Isolated commit:** Yes (one file or one closely-related group per commit).
- **Complexity:** Small (per file).

> **Not in P0:** `api/vercel_webhook.ts` (D3) — infra-dependent, needs a Vercel-settings decision, so it's a manual-review item, not a mechanical P0 delete.

---

## P1 — Duplicate Code Reduction

### P1-1 — Extract a shared `parseHtml` core

- **Current problem:** three `parseHtml` implementations (shared / desktop renderer / mobile web-app) that can drift on sanitization/behavior on the **reader path** (Phase 2 DUP2).
- **Files:** `packages/internal/utils/src/html.ts`, `apps/desktop/layer/renderer/src/lib/parse-html.ts`, `apps/mobile/web-app/html-renderer/src/parser.tsx`.
- **Solution:** first diff the three bodies. Extract shared parsing/sanitization into `@follow/utils`; let each platform inject only its component map / renderer. Keep platform wrappers thin.
- **Benefit:** one source of truth for feed-HTML handling; removes a security/consistency drift risk.
- **Risks:** Medium — touches article rendering. Platform-only deps (DOM vs RN) must not leak into shared.
- **Validation:** `typecheck` + `test` + **reading-flow e2e** on desktop; manual smoke on mobile web-app.
- **Isolated commit:** Yes (single feature-scoped commit), but land behind the reader e2e.
- **Complexity:** Medium.

### P1-2 — Consolidate role-gating predicates

- **Current problem:** `UserRole.Trial`/`Free` gating logic is copy-pasted across desktop and mobile avatar/badge/settings components and `@follow/atoms/helper/setting.ts` (Phase 2 DUP4).
- **Files:** `packages/internal/atoms/src/helper/setting.ts` (+ `constants/enums.ts` `isFreeRole`), desktop `modules/user/UserProBadge.tsx`, `UserAvatar.tsx`, `SubscriptionColumnDock.tsx`; mobile equivalents.
- **Solution:** expose a single `isPaidRole`/`isFreeRole` predicate in the shared package and replace inline `role !== Trial && role !== Free` checks with it.
- **Benefit:** one place to change plan logic; fewer bugs when roles evolve (esp. the deprecated `Trial`).
- **Risks:** Low–Medium; must preserve exact truth tables at each call site.
- **Validation:** `typecheck` + unit test the predicate + `test`.
- **Isolated commit:** Yes.
- **Complexity:** Small–Medium.

### P1-3 — Consolidate `sleep` (optional)

- **Current problem:** identical `sleep` in shared utils and Electron main (Phase 2 DUP1).
- **Files:** `packages/internal/utils/src/utils.ts`, `apps/desktop/layer/main/src/lib/utils.ts`.
- **Solution:** import from `@follow/utils` in main **only if** main already depends on it; otherwise leave (a 1-liner isn't worth a new dependency edge).
- **Benefit:** marginal.
- **Risks:** Low.
- **Validation:** `typecheck` + electron-main build.
- **Isolated commit:** Yes.
- **Complexity:** Small.

### P1-4 — Collapse the `Collapse` component onto `CollapseCss`

- **Current problem:** deprecated `Collapse`/`CollapseGroup` duplicate `CollapseCss*` (Phase 2 DUP3 / dead-code D5).
- **Files:** `packages/internal/components/src/ui/collapse/Collapse.tsx` + the single `<CollapseContent>` caller.
- **Solution:** migrate the remaining caller to `CollapseCssContent`, confirm zero importers of the deprecated names (via `ts-prune`/grep), then remove them.
- **Benefit:** one collapse implementation.
- **Risks:** Medium (shared UI package; check barrel exports).
- **Validation:** `typecheck` + `build:web` + visual check of the affected surface.
- **Isolated commit:** Yes.
- **Complexity:** Small–Medium.

---

## P2 — Structural Improvements

### P2-1 — Break the suspected `subscription ↔ unread` store cycle

- **Current problem:** `subscription/store.ts` imports `unread`, and `unread` imports `subscription` — a likely cycle (Phase 1/Risks R2). Cycles cause fragile init order and hard-to-trace bugs.
- **Files:** `packages/internal/store/src/modules/subscription/*`, `.../unread/*`.
- **Solution:** first **confirm** with `madge --circular` / `dpdm`. If real, invert one edge via an interface, event, or a small mediator (e.g. unread reads subscription ids through a passed-in getter instead of importing the store).
- **Benefit:** safer hydration/reset ordering; lower blast radius for changes.
- **Risks:** Medium–High — core store modules; both feed the sidebar/timeline.
- **Validation:** `typecheck` + `test` + reading/subscription e2e; verify hydrate order unchanged.
- **Isolated commit:** Yes (one edge at a time).
- **Complexity:** Medium.

### P2-2 — Resolve the renderer-local `store/` vs `@follow/store` split

- **Current problem:** `renderer/src/store/{feed,image,search,utils}` coexists with the shared store (Phase 2 D7) — partial migration, unclear ownership.
- **Files:** `apps/desktop/layer/renderer/src/store/*`.
- **Solution:** per subfolder, decide: migrate to `@follow/store` (candidate: `feed/`, if superseded) or formally keep as renderer-only (likely `search/`, `image/`). Document the boundary; delete only what's provably superseded.
- **Benefit:** one clear home per domain; less "which feed store?" confusion.
- **Risks:** High if done bluntly — do it per-subfolder with usage audits.
- **Validation:** `typecheck` + `build:web` + `test`; per-domain smoke.
- **Isolated commit:** Yes (per subfolder).
- **Complexity:** Medium–Large.

### P2-3 — Split god-files (top LOC offenders)

- **Current problem:** 10+ files >550 LOC; `useEntryActions.tsx` (555) and `useFeedActions.tsx` (504) are high-fan-in business hubs (Risks R3).
- **Files:** `hooks/biz/useEntryActions.tsx`, `hooks/biz/useFeedActions.tsx`, `modules/command/commands/integration.tsx` (905), `modules/new-user-guide/onboarding-flow.tsx` (896), `modules/settings/tabs/appearance.tsx` (895), `modules/ai-chat/components/layouts/ChatInterface.tsx` (605).
- **Solution:** extract cohesive sub-actions/sub-components; keep the public hook/component API identical (per the "no public interface changes without approval" rule).
- **Benefit:** testability, reviewability, fewer merge conflicts.
- **Risks:** Medium — behavior must be identical; these touch the core reading UX.
- **Validation:** `typecheck` + `test` + e2e for the reading/onboarding flows.
- **Isolated commit:** Yes (one file at a time).
- **Complexity:** Medium (per file).

### P2-4 — DRY the dual API route mounting

- **Current problem:** every resource mounted twice in `apps/api/src/index.ts` (Phase 2 DUP6) — repetitive, easy to half-update.
- **Files:** `apps/api/src/index.ts`.
- **Solution:** a small helper `mountDual(app, '/x', router)` that registers both `/x` and `/api/v1/x`.
- **Benefit:** fewer errors when adding routes; identical behavior.
- **Risks:** Low.
- **Validation:** `cd apps/api && pnpm run test` (route tests) + `typecheck`.
- **Isolated commit:** Yes.
- **Complexity:** Small.

---

## P3 — High-Risk Architecture Changes

> Document-only for now. Do **not** start without a dedicated design doc and explicit approval.

### P3-1 — Reduce morph-layer coordination cost

- **Current problem:** the 3-representation model (`morph/{api,store-db,db-store}.ts`) forces 4–6 coordinated edits per field change and can silently drift from `@follow-app/client-sdk` (Risks R1).
- **Solution direction:** codegen or schema-driven mapping so store models/DB rows derive from one source; or contract tests against the SDK version.
- **Benefit:** cheaper, safer schema evolution.
- **Risks:** High — central to offline-first behavior; affects both clients.
- **Validation:** full suite + e2e + manual offline testing.
- **Isolated commit:** No (multi-commit, staged behind a design doc).
- **Complexity:** Large.

### P3-2 — Establish the client-SDK contract as a tested boundary

- **Current problem:** API and clients can drift because the external SDK sits between them with no cross-repo type check (Risks R5).
- **Solution direction:** contract/snapshot tests that assert API responses match the SDK types the clients consume; pin/verify the SDK version in CI.
- **Benefit:** catch response-shape breaks before release.
- **Risks:** High effort, cross-repo coordination.
- **Isolated commit:** No.
- **Complexity:** Large.

### P3-3 — Formalize store-module factory (only if churn justifies)

- **Current problem:** repeated store scaffolding per domain (Phase 2 DUP5) — intentional today, but divergence-prone.
- **Solution direction:** a `createDomainStore` factory encapsulating hydrate/reset/upsert; adopt incrementally.
- **Benefit:** consistency, less boilerplate.
- **Risks:** Medium–High (touches every domain store).
- **Complexity:** Large.

---

## Recommended execution order (near-term)

1. **P0-1** (`@supabase/supabase-js`) — smallest, highest-confidence.
2. **P0-2** then **P0-3** (vitest workspace) — resolve config ambiguity.
3. **P0-4** (declare `msw`/`pathe`) — fixes a latent break.
4. **P0-5** (`CommandButton`) — after barrel grep.
5. **P0-6** (commented code) — file-by-file, ongoing.
6. Reassess; then schedule **P1-1** (parseHtml) and **P1-2** (role predicate) as the first behavior-touching consolidations, each behind the e2e net.
7. Run the deferred tooling pass (`knip`/`ts-prune`/`madge`) to unlock the remaining dead-code and cycle items **before** starting P2.

## Open decisions needed before starting

- P0-3: delete `vitest.workspace.ts` vs make it canonical?
- D3/webhook: what is the Flash Vercel project root (`apps/api` vs repo root)?
- P2-2: which renderer-local stores are superseded by `@follow/store`?
- P3-1/P3-2: is regenerating/contract-testing `@follow-app/client-sdk` in scope, or is it a hard external boundary?
