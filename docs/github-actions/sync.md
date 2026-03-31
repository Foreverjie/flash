# `sync.yaml`

## Function

Automatically opens a PR to sync `main` into `dev` after pushes to `main`.

## Trigger

- Push to `main`

## Affected Modules

- Git branch management
- `main` to `dev` integration workflow

## Inputs, Secrets, Environment

- Uses built-in `github.token`
- Uses `gh` CLI in the runner environment

## Flow Logic

1. Checkout repository with full history.
2. Configure git author identity for GitHub Actions.
3. Create a dated sync branch name like `sync/main-to-dev-YYYYMMDD`.
4. Checkout `main`.
5. Create or reset the sync branch from `main`.
6. Compare `origin/dev...` against the sync branch.
7. If there is no diff:
   - exit successfully
8. If diff exists:
   - force-push sync branch to origin
   - create a PR from sync branch into `dev`
   - tolerate failure if a duplicate PR already exists

## Outputs and Side Effects

- Sync branch pushed to origin
- PR from synced `main` state into `dev`

## Notes

- This workflow automates branch hygiene, not product build validation.
