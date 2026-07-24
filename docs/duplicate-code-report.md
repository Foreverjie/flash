# Duplicate Code Report

> Phase 2 analysis. **No code was modified.** Candidate consolidations for later phases (mostly P1). Each item notes whether the duplication is _accidental_ (should merge) or _intentional/platform-specific_ (leave, or extract only the shared core). Confidence reflects static evidence.

## Legend

- **Merge** — genuine duplication; consolidate into a shared package.
- **Extract-core** — variants differ by platform/runtime; extract only the shared logic.
- **Keep** — duplication is intentional (platform boundary); do not merge.

---

## DUP1 — `sleep()` defined twice

- **Files:**
  - `packages/internal/utils/src/utils.ts` — `export const sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms))`
  - `apps/desktop/layer/main/src/lib/utils.ts` — `export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))`
- **Analysis:** functionally identical (the only difference is the explicit `<void>` generic). The main-process copy could import from `@follow/utils`.
- **Reason duplicated:** likely to keep the Electron main process dependency-light / avoid pulling the shared package.
- **Recommended action:** **Merge** if the main process already depends on `@follow/utils`; otherwise leave (a 1-line trivial helper isn't worth a new dependency edge).
- **Risk:** Low. **Confidence:** High (they are duplicates); Medium (on whether merging is worth it).

## DUP2 — `parseHtml()` "three parsers" (CORRECTED + RESOLVED)

- **Files:**
  - `packages/internal/utils/src/html.ts` — `parseHtml` (shared core: parsing + **sanitization**)
  - `apps/desktop/layer/renderer/src/lib/parse-html.ts` — desktop wrapper
  - `apps/mobile/web-app/html-renderer/src/parser.tsx` — mobile web-app wrapper
- **Correction (Phase 4):** the original "three parsers that can drift on sanitization" premise was **wrong**. The desktop and mobile-web files are **not** separate parsers — both already delegate to the shared `parseHtmlGeneral` (`@follow/utils/html`) and only inject a platform-specific React `components` map. So sanitization already lived in exactly one place; there was no sanitization-drift risk. The component maps differ **intentionally** (desktop `Media`/`ShadowDOM`/desktop-Shiki vs mobile `MarkdownImage`/mobile-Shiki, different link/video handling) and must stay separate.
- **Actual duplication found:** the DOM helper `extractCodeFromHtml` was **byte-identical** across the desktop and mobile-web files (~57 lines each).
- **Resolution:** extracted `extractCodeFromHtml` into `@follow/utils/extract-code`; both renderers now import it; its 15-case test suite was relocated from the desktop app (where it ran in no configured runner) to `packages/internal/utils` (happy-dom vitest project) and now executes. Validated: typecheck 18/18, utils tests 50 passed, `build:web` success. Component maps left untouched.
- **Status:** Resolved.

## DUP3 — Deprecated `Collapse` vs `CollapseCss` (two implementations of one component)

- **File:** `packages/internal/components/src/ui/collapse/Collapse.tsx`
- **Analysis:** the file ships an older JS-driven `Collapse`/`CollapseGroup`/`CollapseContent` **and** the newer CSS-driven `CollapseCss*` that supersedes it (per the `@deprecated` notes). The old family is largely unused (see `docs/dead-code-report.md` D5).
- **Recommended action:** consolidate onto `CollapseCss*`; migrate the single remaining `<CollapseContent>` caller, then remove the deprecated family.
- **Risk:** Medium (shared UI). **Confidence:** Medium.

## DUP4 — Platform-parallel components (intentional — mostly Keep)

Desktop and mobile each ship their own version of several UI concepts. These are **expected** platform splits (Tailwind/DOM vs NativeWind/RN), not accidental duplication:
| Concept | Desktop | Mobile |
| --- | --- | --- |
| `UserAvatar` | `renderer/.../modules/user/UserAvatar.tsx` | `apps/mobile/src/components/ui/avatar/UserAvatar.tsx` |
| Store/atoms structure | `renderer/src/{store,atoms}` | `apps/mobile/src/{store,atoms}` |
| `initialize/`, `providers/` | desktop renderer | mobile |

- **Recommended action:** **Keep** the UI split. BUT audit for **business logic** (role checks, formatting, action orchestration) copy-pasted between them — that logic belongs in shared packages (`@follow/store`, `@follow/atoms`, `@follow/utils`). Example smell: `UserRole.Trial`/`Free` gating logic appears in both desktop and mobile avatar/badge components and in `@follow/atoms/helper/setting.ts` — consolidate the _predicate_ (e.g. an `isPaidRole`) into the shared helper and reuse.
- **Risk:** Low–Medium. **Confidence:** Medium.

## DUP5 — Store module boilerplate (structural repetition, not literal duplication)

- **Path:** `packages/internal/store/src/modules/*/` — every domain repeats the same file quintet (`store.ts` / `getter.ts` / `selectors.ts` / `hooks.ts` / `types.ts` / `utils.ts`) and the same Zustand+immer+transaction scaffolding via `lib/helper.ts`.
- **Analysis:** this is _intentional_ consistency, and it is already partly factored (`createZustandStore`, `createImmerSetter`, `createTransaction`, `Hydratable`/`Resetable` interfaces). Not a bug — but the repeated hydrate/reset/upsert patterns are candidates for a shared store factory if churn is high.
- **Recommended action:** **Keep**; consider a `createDomainStore` factory only if Phase 3 shows repeated bugs from divergent copies. Low priority.
- **Risk:** Low. **Confidence:** High (pattern is intentional).

## DUP6 — Dual API route mounting (structural, by design)

- **File:** `apps/api/src/index.ts`
- **Analysis:** every resource is mounted twice (`/x` and `/api/v1/x`) — not code duplication (same router instance), but a repeated registration pattern that's easy to get half-right when adding routes.
- **Recommended action:** **Keep** behavior; optionally DRY the mount with a small helper that registers both paths from one call. Low priority.
- **Risk:** Low. **Confidence:** High.

---

## How to confirm the "Merge" candidates before acting (Phase 5 prep)

1. Diff the bodies (`parseHtml`, `sleep`) to confirm behavioral equivalence, not just name equality.
2. Grep all importers of each variant; ensure a single shared version satisfies every call site's signature.
3. For shared-package moves, check that no platform-only dependency (DOM, RN, Electron) leaks into the shared package.
4. Protect with `pnpm run typecheck` + `pnpm run test` + the reading-flow e2e for DUP2 (reader path).
