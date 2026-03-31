# `tag.yml`

## Function

Creates release tags from specially formatted commit messages, then dispatches downstream build workflows.

## Trigger

- Push to `main`

## Affected Modules

- Git tagging and release orchestration
- `.github/scripts/extract-release-info.mjs`
- Downstream:
  - `build-desktop.yml`
  - `build-android.yml`

## Inputs, Secrets, Environment

- Secret: `GITHUB_TOKEN`

## Flow Logic

1. Checkout repository.
2. Setup Node using `lts/*`.
3. Mark `.github/scripts/extract-release-info.mjs` executable.
4. Run the script to inspect the latest commit message.
5. The script searches for patterns:
   - `release(desktop): Release vX.Y.Z`
   - `release(mobile): Release vX.Y.Z`
6. If no release commit is found:
   - exit without tagging
7. If a release commit is found:
   - export:
     - `tag_version`
     - `platform`
     - `version`
   - configure git identity
   - create the tag if it does not already exist
   - push the tag to origin
8. In `trigger_builds` job:
   - if platform is `desktop`, dispatch `build-desktop.yml` with `tag_version=true`
   - if platform is `mobile`, dispatch `build-android.yml` with `release=true`

## Outputs and Side Effects

- Git tag pushed to origin
- Downstream workflow dispatch for desktop or mobile release build

## Notes

- This is the release entrypoint for automated tagging.
- It does not itself build artifacts; it triggers the appropriate build workflow.
