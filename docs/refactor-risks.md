# Refactor Risks & Fragile Areas

> Phase 1 analysis. Read-only inspection; nothing here has been changed. Confidence is stated where the evidence is indirect. Items marked **VERIFY** need a tooling pass (e.g. `madge`/`dpdm` for cycles, `depcheck`, `knip`/`ts-prune` for dead code) before acting — these have not been run in this phase.

## 1. Highest-risk / most fragile areas

### R1 — The 3-layer morph model (`packages/internal/store/src/morph/`)

- **Why fragile:** every domain object exists as API DTO, store model, and DB row, with `morph/{api,store-db,db-store}.ts` translating between them. `morph/api.ts` fans in from `@follow/database` schemas **and** `@follow-app/client-sdk`, and fans out to all store model types. A single new field commonly requires coordinated edits in 4–6 files across two packages.
- **Blast radius:** all clients (desktop + mobile) via `@follow/store`.
- **Coupling to external contract:** shapes are pinned to the published `@follow-app/client-sdk` version (catalog). API and client can silently drift because the SDK sits between them.
- **Risk:** High. **Confidence:** High.

### R2 — `@follow/store` as a mega-hub with intra-module coupling

- **Why fragile:** store modules import each other's `store.ts` directly. `subscription/store.ts` pulls in `feed`, `inbox`, `list`, `unread`, `user`. Measured most-imported modules: `entry` (7), `feed` (6), `user` (4), `subscription` (4).
- **Potential cycle:** `subscription ↔ unread` (each imports the other). **VERIFY** with a cycle detector.
- **Risk:** High. **Confidence:** High for coupling, Medium for the specific cycle (needs tool confirmation).

### R3 — Oversized business hooks & feature modules

Largest renderer files (candidate god-objects / split targets):
| File | LOC |
| --- | --- |
| `modules/command/commands/integration.tsx` | 905 |
| `modules/new-user-guide/onboarding-flow.tsx` | 896 |
| `modules/settings/tabs/appearance.tsx` | 895 |
| `modules/ai-chat/components/message/parse-incomplete-markdown.ts` | 707 |
| `components/ui/media/PreviewMediaContent.tsx` | 661 |
| `modules/settings/tabs/integration/CustomIntegrationModal.tsx` | 631 |
| `modules/settings/tabs/feeds.tsx` | 616 |
| `modules/ai-chat/components/layouts/ChatInterface.tsx` | 605 |
| `hooks/biz/useEntryActions.tsx` | 555 |
| `modules/subscription-column/FeedCategory.tsx` | 549 |
| `hooks/biz/useEntryActions` / `useFeedActions` | 555 / 504 |

- **Why fragile:** `useEntryActions`/`useFeedActions` centralize many cross-cutting actions (read/star/share/AI/context-menu) and are imported widely; changes here touch the whole reading experience.
- **Risk:** Medium–High. **Confidence:** High (size), Medium (fragility depends on fan-in — VERIFY import counts).

### R4 — Provider order encodes hidden runtime dependencies

- `providers/root-providers.tsx` nests ~15 providers in a specific order (jotai → motion → query/persist → focusable → hotkey → i18n → modal → user/config → lazy). Reordering can break features silently (e.g. hotkeys before focusable, modals before i18n).
- Similarly, `main.tsx` **must** provide `api/auth/query` JS-singleton contexts before `initializeApp()` runs, and `initializeApp` has an ordering-sensitive sequence (DB hydrate → settings → i18n → analytics).
- **Risk:** Medium. **Confidence:** High.

### R5 — Dual-path API mounting and SDK indirection

- Every API resource is mounted at both `/x` and `/api/v1/x` (`apps/api/src/index.ts`). Adding/removing a route requires editing both, and the client reaches it through the external SDK, so contract mismatches are not caught by the type system across the repo boundary.
- Legacy `/better-auth/*` → `/api/auth/*` rewrite exists for SDK compatibility — an easy-to-miss compatibility shim.
- **Risk:** Medium. **Confidence:** High.

## 2. Coupling & layering smells to investigate

| Smell                                               | Location                                         | Note                                                                   |
| --------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Store modules importing sibling stores              | `packages/internal/store/src/modules/*/store.ts` | Introduce interfaces / event bus to break cycles (P2/P3)               |
| JS-singleton contexts instead of DI                 | `@follow/store/context.ts`                       | Works, but hides ordering dependencies; document, don't rush to change |
| Renderer `store/` re-export glue vs `@follow/store` | `apps/desktop/.../store`                         | Confirm it's a thin shim, not divergent logic                          |
| Business logic in hooks vs store                    | `hooks/biz/*` vs store actions                   | Some entry/feed logic likely duplicated between the two — VERIFY       |
| Mobile vs desktop parallel structure                | `apps/mobile/src/{modules,store,atoms}`          | Check for copy-pasted logic that should live in shared packages        |

## 3. Dead / redundant code — candidate hotspots (for Phase 2, not confirmed)

- Two Vitest workspace files: `vitest.workspace.js` **and** `vitest.workspace.ts` — likely one is stale. **VERIFY.**
- Two locations for API code: top-level `api/` dir **and** `apps/api/` — confirm the top-level `api/` isn't a leftover. **VERIFY.**
- `providers/lazy/` and various `Lazy*` providers — confirm all are still referenced.
- Renderer has ~893 TS/TSX files; expect unused exports. Run `knip`/`ts-prune` + `depcheck` (`pnpm run depcheck` script exists) in Phase 2.
- `docs/superpowers/plans` reference features (scrapling, mobile-web-jike, account-drawer) — cross-check for half-migrated/abandoned code paths.

## 4. Areas needing dynamic-reference caution (do NOT delete on static analysis alone)

- **File-based routes:** `pages/**` → `generated-routes.ts` (build-time). A "referenced-by-nobody" page file is still a live route.
- **Command registry:** `modules/command/*` — commands may be registered by string id; grep for id usage, not imports.
- **Lazy/dynamic imports:** `providers/lazy/`, `import("./push-notification")`, code-split modules.
- **i18n keys:** flat keys in `/locales` are referenced by string; unused-key detection needs an i18n-aware tool.
- **Electron bridge:** `registerGlobalContext` / `@follow/shared/bridge` — cross-process string contracts.
- **Store event/action names & migrations:** `initialize/migrates/*` run by version; old migrations look dead but must stay.
- **Icons:** `i-mgc-*` classes are string-based (Tailwind/Iconify) — not import-tracked.
- **API seed/cron scripts:** `apps/api/src/scripts/*`, `routes/cron.ts` — invoked by CI/Vercel cron, not by app code.

## 5. Suggested tooling to run in Phase 2 (before any deletion)

1. `pnpm run depcheck` (already scripted) per app — unused deps.
2. `npx dpdm` or `madge --circular` over `packages/internal/store/src` and the renderer `src` — confirm/deny cycles (esp. `subscription ↔ unread`).
3. `npx knip` (i18n + dynamic-import aware config) for unreferenced files/exports.
4. `pnpm run typecheck` + `pnpm run lint` as the baseline green state to protect.
5. Playwright e2e (`/e2e`, port 2233) as the behavioral safety net for P2/P3 changes.

## 6. Top 5 risk-ranked modules (summary)

1. `packages/internal/store` (morph + inter-module coupling) — widest blast radius.
2. `@follow-app/client-sdk` contract boundary (API ↔ clients) — silent drift risk.
3. `hooks/biz/useEntryActions.tsx` / `useFeedActions.tsx` — central, large, high fan-in.
4. `providers/root-providers.tsx` + `initialize/index.ts` — ordering-sensitive bootstrap.
5. `modules/ai-chat/*` and `modules/settings/tabs/*` — large, feature-dense, fast-moving.
