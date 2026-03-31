# `lint.yml`

## Function

Runs the repository-wide quality gate pipeline: build, format check, typecheck, lint, and tests.

## Trigger

- Any pull request
- Push to `main`
- Push to `dev`

## Affected Modules

- Entire monorepo
- `apps/desktop` web build path
- `apps/ssr`
- All packages participating in Turbo tasks

## Inputs, Secrets, Environment

- Fixed env values in workflow:
  - `VITE_WEB_URL=https://app.scflash.win`
  - `VITE_API_URL=https://api.scflash.win`

## Flow Logic

1. Checkout repository with LFS enabled.
2. Restore Turbo cache.
3. Checkout LFS objects.
4. Setup pnpm and Node using `lts/*`.
5. Install dependencies with `pnpm install`.
6. Build the web renderer and SSR service first.
7. Run:
   - `format:check`
   - `typecheck`
   - `lint`
8. Run all Turbo-managed tests.

## Outputs and Side Effects

- Main CI gate result for code quality

## Notes

- This workflow is the broadest correctness gate in the repository.
- It intentionally validates buildability before style and static analysis.
