# `build-web.yml`

## Function

Builds the desktop web renderer and the SSR service together as a CI integration check.

## Trigger

- Any pull request
- Push to `main`
- Push to `dev`

## Affected Modules

- `apps/desktop` web renderer build path
- `apps/ssr`
- Shared packages used by web and SSR

## Inputs, Secrets, Environment

- No custom secrets required in the workflow itself
- Uses standard checkout and Node setup actions

## Flow Logic

1. Checkout repository with LFS enabled.
2. Restore Turbo cache from `.turbo`.
3. Checkout LFS objects.
4. Setup pnpm.
5. Setup Node using `lts/*`.
6. Install dependencies with `pnpm install`.
7. Run a combined Turbo build:
   - `Folo#build:web`
   - `@follow/ssr#build`

## Outputs and Side Effects

- CI confirmation that both web-facing build targets still compile together

## Notes

- This workflow is a build-only pipeline.
- It does not lint, typecheck, or run tests.
