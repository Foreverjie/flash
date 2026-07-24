# Dead / Redundant Code Report

> Phase 2 analysis. **No code was modified or deleted.** This is a candidate list for review, not an approval to delete. Confidence reflects the strength of static evidence only; dynamic references (routes, string ids, i18n, cron, external apps) were checked where noted but cannot be fully proven statically. Nothing here should be removed without the Phase 5 safety checklist.
>
> Tooling used: repo-scripted `depcheck` (no install), targeted `grep`, and manual inspection. `knip`/`ts-prune`/`madge` are **not installed** and were not run — several items below are explicitly deferred to that pass.

## Legend

- **Confidence: High** — strong static evidence, dynamic-reference vectors checked.
- **Confidence: Medium** — likely unused, but a plausible dynamic/external reference remains.
- **Confidence: Low** — smells unused; needs tooling or a human to confirm.

---

## D1 — Duplicate & non-functional Vitest workspace config

- **Files:** `vitest.workspace.js`, `vitest.workspace.ts` (repo root)
- **Location:** both files, entire contents.
- **Evidence:** identical bodies (`defineWorkspace(["apps/*"])`), both carry the self-comment `// NOT work`. Tests actually run via the root script `pnpm --recursive run test`, and `apps/api` uses its own `apps/api/vitest.config.ts`. Grep found **zero** references to `vitest.workspace` anywhere.
- **Known references:** none.
- **Possible dynamic refs:** Vitest auto-discovers `vitest.workspace.ts` by filename convention — so the `.ts` one _could_ be picked up by a bare `vitest` invocation, but the comment and the recursive test script indicate it is not the intended path.
- **Deletion risk:** Low.
- **Recommended action:** Remove `vitest.workspace.js` (pure duplicate). Decide intentionally on `vitest.workspace.ts` — either make it work or delete it. **Verify** with `pnpm run test` before/after.
- **Confidence:** High (`.js`), Medium (`.ts`).

## D2 — Unused dependency `@supabase/supabase-js` in `apps/api`

- **File:** `apps/api/package.json` (dependency)
- **Evidence:** `depcheck` reports it unused; grep found **no** `@supabase/supabase-js` import and **no** `createClient` usage under `apps/api/src`. The app talks to Postgres via Drizzle, not the Supabase JS client.
- **Possible dynamic refs:** none found; Supabase is used only as the Postgres host (connection string), not via this SDK.
- **Deletion risk:** Low.
- **Recommended action:** Remove from `apps/api` dependencies (this _does_ touch the lockfile — allowed only in the deps-change case). Re-run `typecheck` + `test`.
- **Confidence:** High.

## D3 — Legacy root Vercel webhook `api/vercel_webhook.ts`

- **File:** `api/vercel_webhook.ts` (repo-root `api/` dir, separate from `apps/api`)
- **Evidence:** a Vercel serverless handler that purges **Cloudflare** cache on `deployment.succeeded`, referencing the upstream Follow infrastructure. Flash deploys the Hono server from `apps/api`; `vercel.json` rewrites point at `follow-external-ssr-follow.vercel.app` under host `app.follow.is` (upstream domains, not Flash's `scflash.win`).
- **Known references:** none in code; Vercel auto-detects files under a project's `api/` dir by convention.
- **Possible dynamic refs:** **depends on the Vercel project's root directory setting.** If the Flash Vercel project root is `apps/api` (likely), this root `api/` file is never deployed and is dead. If a project deploys the repo root, it is live.
- **Deletion risk:** Medium (infra-dependent).
- **Recommended action:** **Manual review** — confirm the Flash Vercel project root/build settings. If root is `apps/api`, this is safe to delete; otherwise it's live legacy infra tied to `app.follow.is`.
- **Confidence:** Medium.

## D4 — Deprecated `CommandActionButton` / `CommandIdButton` (CORRECTED — NOT dead)

- **File:** `apps/desktop/layer/renderer/src/modules/command/command-button.tsx`
- **Location:** `@deprecated` exports `CommandActionButton` (line ~23) and `CommandIdButton` (line ~44), plus exported type `CommandIdButtonProps`.
- **Phase 4 correction:** the original Phase 2 note grepped `CommandButton` (which only matched the _internal type name_ `CommandButtonProps`) and wrongly concluded "no external references." A precise grep of the actual export names finds live consumers:
  - **`command-button.test-d.ts`** (a type-level test in the same module) imports and exercises both `CommandActionButton` and `CommandIdButton`. These `.test-d.ts` files are `.ts` in the TS program and are compiled by `pnpm run typecheck`, so the import is load-bearing — removing the exports breaks typecheck unless the test is removed too.
  - **Naming collision:** a _different, live_ component `~/components/ui/button/CommandActionButton.tsx` shares the name `CommandActionButton` and is actively used by `entry-content/actions/header-actions.tsx` and `entry-column/layouts/EntryItemWrapper.tsx`. Easy to conflate.
- **Deletion risk:** Medium (coupled: deleting the exports requires deleting/rewriting `command-button.test-d.ts`, and touches a deprecated public export of the module).
- **Recommended action:** **Manual review / P1, not a mechanical P0.** If the deprecated pair is truly to be retired: (1) confirm nothing outside the type test consumes them, (2) delete `command-button.tsx`'s deprecated exports **and** `command-button.test-d.ts` together, (3) `typecheck` + `build:web`. Do **not** touch the same-named live `components/ui/button/CommandActionButton.tsx`.
- **Confidence:** High (that they are still referenced by the type test → **not** safe for a P0 delete).

## D5 — Deprecated `Collapse` / `CollapseGroup` (non-Css variants)

- **File:** `packages/internal/components/src/ui/collapse/Collapse.tsx`
- **Location:** `@deprecated` exports superseded by `CollapseCss` / `CollapseCssGroup` / `CollapseCssContent`.
- **Evidence:** JSX-usage counts across the repo: `<CollapseCss>` ×7, `<CollapseCssGroup>` ×4, `<CollapseCssContent>` ×1, `<CollapseContent>` ×1, `<CollapseGroup>` ×0, `<Collapse>` ×0. The plain `Collapse`/`CollapseGroup` appear unused; `CollapseContent` is still used once.
- **Possible dynamic refs:** shared component package — could be imported by an app not fully scanned, or re-exported via a barrel. Check `@follow/components` index exports.
- **Deletion risk:** Medium (shared package; partial family still used).
- **Recommended action:** Keep for now; **defer to `ts-prune`/`knip`** to confirm zero importers of the deprecated names before removal. Do not remove `CollapseContent` (still used).
- **Confidence:** Medium.

## D6 — Deprecated-but-still-referenced (DO NOT DELETE; migrate first)

These carry `@deprecated` but have live callers, so they are **not** dead code today:
| Symbol | File | Live references |
| --- | --- | --- |
| `resolveUrlWithBase` | `packages/internal/utils/src/utils.ts:217` | `hooks/common/useFeedSafeUrl.ts`, `modules/command/commands/entry.tsx` |
| `UserRole.Trial` / `UserRoleName[Trial]` | `packages/internal/constants/src/enums.ts` | 10+ call sites across desktop, mobile, and `@follow/atoms` (`useEntryActions`, `UserProBadge`, `UserAvatar`, settings, etc.) |
| deprecated command-binding helper | `modules/command/hooks/use-command-binding.ts:141` | check callers before removal |
| `SafeNavigationScrollView` deprecation | `apps/mobile/.../SafeNavigationScrollView.tsx:183` | mobile-only; verify |

- **Recommended action:** Track as migration debt, not deletion. Removing any of these requires first replacing call sites (P1/P2 work), then deleting.
- **Confidence:** High (that they are still used).

## D7 — Renderer-local `store/` (parallel to `@follow/store`)

- **Path:** `apps/desktop/layer/renderer/src/store/` — contains real local stores: `feed/`, `image/`, `search/`, `utils/` (with tests), **not** a thin re-export of `@follow/store`.
- **Evidence:** Phase 1 assumed this was a shim; it is not. It coexists with the shared `@follow/store` package, suggesting a **partial migration** — some domains moved to the shared package, some remain local.
- **Possible dynamic refs:** actively imported by renderer modules (needs per-file usage check).
- **Deletion risk:** High if removed blindly.
- **Recommended action:** **Manual review** — determine per-subfolder whether it's superseded by `@follow/store` (candidate: `feed/`) or still the only implementation (likely: `search/`, `image/`). Do not treat as a block.
- **Confidence:** Low (as "dead"); High (as "needs decoupling review" — see `docs/refactor-risks.md`).

## D8 — Commented-out code & TODO backlog (low-priority cleanup)

- **Evidence:** ~58 `TODO`/`FIXME`/`HACK`/`XXX` markers across `apps/desktop` renderer, `packages/internal`, and `apps/api/src`. Files with notable commented-out blocks include: `constants/ui.ts`, `components/common/SharePanel.tsx`, `lib/observe-resize.ts`, `modules/settings/helper/setting-builder.tsx`, `modules/feed/feed-icon.tsx`, `modules/entry-column/components/mark-all-button.tsx`, `modules/command/registry/registry.ts`, `modules/new-user-guide/ai-chat-pane.tsx`, `store/utils/helper.ts`.
- **Deletion risk:** Low (comments only) — but each block should be read; some may be intentional documentation or disabled-on-purpose logic.
- **Recommended action:** P0 cleanup, file-by-file, only after reading each block. Do not bulk-strip.
- **Confidence:** Low (that any specific block is safe to remove without reading it).

---

## Items explicitly deferred to a tooling pass (not yet claimable)

Static grep cannot safely enumerate these; run `knip` / `ts-prune` / `madge` (with i18n + dynamic-import awareness) in a dedicated pass before acting:

- Unreferenced **files** across the ~893-file renderer.
- Unused **exports** (functions/types/constants) within otherwise-used files.
- Unused **i18n keys** in `/locales` (string-referenced — needs an i18n-aware linter).
- Unused **store selectors/actions** (many selectors per module; some may have no callers).
- Unused **`queries/*`** hooks and **API SDK methods**.
- Circular-dependency-driven dead branches (e.g. the suspected `subscription ↔ unread` cycle).

## Missing-but-used dependencies (correctness note, not dead code)

`depcheck` on `apps/api` flags `msw` and `pathe` as **used in source but not declared** in `apps/api/package.json` (resolved today only via workspace hoisting). Not dead code, but a latent breakage if hoisting changes. Recommend declaring them explicitly. **Confidence:** High.
