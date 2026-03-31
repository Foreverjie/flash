## GitHub Actions Local Check

Date: 2026-03-31
Workspace: `/Users/zhangzijie/work/flash`
Host: macOS, Node `20.13.1`, pnpm `10.17.0`, Python `3.13.3`, Xcode `26.4`

### Summary

- YAML syntax: all workflow files parse successfully.
- Fully validated locally:
  - `scraper-ci.yml`
  - repo-owned parts of `tag.yml`
- Partially validated locally:
  - `build-desktop.yml`
  - `build-web.yml`
  - `lint.yml`
  - `build-ios.yml`
  - `build-ios-development.yml`
  - `sync.yaml`
  - `scraper-deploy.yml`
- Event-only / remote-service workflows not meaningfully executable end-to-end locally:
  - `issue-labeler.yml`
  - `pr-title-check.yml`
  - `similar-issues.yml`
  - `translator.yml`

### What I ran

- `pytest tests/ -v` in `apps/scraper`
- `npm exec turbo run Folo#build:web @follow/ssr#build`
- `export NODE_OPTIONS="--max_old_space_size=16384" && npm exec turbo run format:check typecheck lint`
- `npm exec turbo run test`
- `pnpm --dir apps/desktop build:electron-vite`
- `pnpm --dir apps/desktop build:render`
- `pnpm --dir apps/mobile typecheck`
- `xcodebuild build -workspace apps/mobile/ios/Flash.xcworkspace -scheme Flash -sdk iphonesimulator -configuration Release CODE_SIGNING_ALLOWED=NO`
- `.github/scripts/extract-release-info.mjs`

### Workflow Status

#### `scraper-ci.yml`

- Status: pass
- Evidence:
  - `apps/scraper` test suite passed: `18 passed`

#### `scraper-deploy.yml`

- Status: partially validated
- What works:
  - Same pytest step as `scraper-ci.yml` passed.
- Blockers:
  - `docker` is not installed locally, so `docker/setup-buildx-action` and image build/push could not be validated.
  - Deploy step needs SSH secrets and a reachable VPS.
- Missing keys / required secrets:
  - `VPS_HOST`
  - `VPS_USER`
  - `VPS_SSH_KEY`

#### `build-web.yml`

- Status: failed locally
- Findings:
  - `@follow/ssr#build` built the Vite bundle, then failed in the `tsx scripts/prepare-vercel-build.ts` part with:
    - `listen EPERM ... /var/.../tsx-501/...pipe`
    - this looks like a local sandbox / `tsx` IPC restriction, not a repo logic failure in the workflow YAML
  - `Folo#build:web` emitted a PostCSS error during build:
    - `Lexical error on line 1: Unrecognized text`
    - source shown by Vite points at `packages/internal/components/assets/index.css`
- Extra local mismatch:
  - local Node is `20.13.1`
  - repo `.nvmrc` is `22`
  - Vite warns that it wants `20.19+` or `22.12+`

#### `lint.yml`

- Status: failed locally
- Findings:
  - `format:check typecheck lint` failed in `tsslint`
  - exact error:
    - `TypeError: fs.globSync is not a function`
  - this is consistent with running on local Node `20.13.1`; the repo targets Node `22`
  - `npm exec turbo run test` failed because `apps/api` tests tried to connect to PostgreSQL and could not
- Environment blocker:
  - local `apps/api/.env` exists and appears to point tests at a real Postgres instance
  - tests failed with `connect EPERM ... :5432`

#### `build-desktop.yml`

- Status: partially validated
- What works locally:
  - `pnpm --dir apps/desktop build:electron-vite` completed successfully
  - `pnpm --dir apps/desktop build:render` completed successfully
- Findings:
  - renderer build logs the same PostCSS lexical error as `build-web.yml`
  - renderer build also logs:
    - `"handle" is not exported by "layer/renderer/src/pages/(main)/index.sync.tsx"`
  - `build:render` also logs `fatal: No names found, cannot describe anything.` because this clone has no git tags
- Not validated locally:
  - `pnpm --dir apps/desktop update:main-hash`
    - blocked by the same `tsx` IPC `listen EPERM` failure
  - platform packaging / signing / store publishing
- Missing vars / secrets for full workflow:
  - `VITE_WEB_URL`
  - `VITE_API_URL`
  - `VITE_SENTRY_DSN`
  - `VITE_OPENPANEL_CLIENT_ID`
  - `VITE_OPENPANEL_API_URL`
  - `VITE_FIREBASE_CONFIG`
  - `SENTRY_AUTH_TOKEN`
  - macOS signing path:
    - `BUILD_CERTIFICATE_BASE64`
    - `BUILD_CERTIFICATE_MAS_BASE64`
    - `BUILD_CERTIFICATE_MASPKG_BASE64`
    - `BUILD_PROVISION_PROFILE_BASE64`
    - `P12_PASSWORD`
    - `KEYCHAIN_PASSWORD`
    - `APPLE_ID`
    - `APPLE_PASSWORD`
    - `APPLE_TEAM_ID`
    - `OSX_SIGN_IDENTITY`
    - `OSX_SIGN_IDENTITY_MAS`
  - Windows signing:
    - `SIGNPATH_API_TOKEN`

#### `build-ios.yml`

- Status: partially validated
- What works locally:
  - `pnpm --dir apps/mobile typecheck` passed
- Failed local validation:
  - simulator compile check failed before project compilation because local Xcode install is unhealthy:
    - required plugin `IDESimulatorFoundation` failed to load
    - Xcode suggests `xcodebuild -runFirstLaunch`
- Not safely run in the shared worktree:
  - `npx expo prebuild --platform ios --clean`
  - command prompts because it wants to rewrite generated native files; I declined to avoid a large generated diff
- Missing secrets for full workflow:
  - `RUNNER_GITHUB_TOKEN`
  - `EXPO_TOKEN`
  - `RN_SENTRY_AUTH_TOKEN`
- Additional requirements:
  - healthy Xcode + simulator toolchain
  - Apple / Expo credentials for `eas build` and `eas submit`

#### `build-ios-development.yml`

- Status: same blockers as `build-ios.yml`
- Missing secrets:
  - `RUNNER_GITHUB_TOKEN`
  - `EXPO_TOKEN`
  - `RN_SENTRY_AUTH_TOKEN`

#### `build-android.yml`

- Status: not executable locally end-to-end
- Why:
  - workflow uses `eas build --local`
  - local command path depends on Expo auth plus Android SDK / Java setup matching CI
- Missing secret:
  - `EXPO_TOKEN`
- Additional requirements:
  - Android SDK
  - JDK 17
  - Expo credentials / local EAS build prerequisites

#### `tag.yml`

- Status: repo-owned logic validated
- What I checked:
  - `.github/scripts/extract-release-info.mjs` runs
  - on the current commit it exits `1` correctly because the latest commit is not a release commit
  - setup-version tag parsing logic resolves `desktop/v1.2.3` to `1.2.3`
- Local limitation:
  - repo currently has no git tags, so any build step relying on `git describe --tags` reports `version: unknown`
- Remote-only parts:
  - pushing tags
  - dispatching other workflows via GitHub API

#### `sync.yaml`

- Status: partially validated
- What works locally:
  - `gh` is installed
- Not validated:
  - branch push / PR creation require remote GitHub access and auth

#### `issue-labeler.yml`

- Status: not locally executable end-to-end
- Reason:
  - depends on GitHub issue event payload and hosted actions
- Secret used:
  - `GITHUB_TOKEN`

#### `similar-issues.yml`

- Status: not locally executable end-to-end
- Reason:
  - depends on GitHub issue event payload, GitHub Models inference endpoint, and MCP integration
- Missing / required secrets:
  - `USER_PAT`
  - `GITHUB_TOKEN`

#### `translator.yml`

- Status: not locally executable end-to-end
- Reason:
  - depends on GitHub issue/discussion/comment events and a hosted marketplace action
- Secret used:
  - `GITHUB_TOKEN`

#### `pr-title-check.yml`

- Status: not locally executable end-to-end
- Reason:
  - depends on GitHub pull request event payload and hosted action

### Missing Keys / Secrets Inventory

These workflows cannot be fully validated in this workspace because the workflow logic depends on missing or remote-only credentials:

- `build-android.yml`
  - `EXPO_TOKEN`
- `build-ios.yml`
  - `RUNNER_GITHUB_TOKEN`
  - `EXPO_TOKEN`
  - `RN_SENTRY_AUTH_TOKEN`
- `build-ios-development.yml`
  - `RUNNER_GITHUB_TOKEN`
  - `EXPO_TOKEN`
  - `RN_SENTRY_AUTH_TOKEN`
- `build-desktop.yml`
  - `VITE_WEB_URL`
  - `VITE_API_URL`
  - `VITE_SENTRY_DSN`
  - `VITE_OPENPANEL_CLIENT_ID`
  - `VITE_OPENPANEL_API_URL`
  - `VITE_FIREBASE_CONFIG`
  - `SENTRY_AUTH_TOKEN`
  - `BUILD_CERTIFICATE_BASE64`
  - `BUILD_CERTIFICATE_MAS_BASE64`
  - `BUILD_CERTIFICATE_MASPKG_BASE64`
  - `BUILD_PROVISION_PROFILE_BASE64`
  - `P12_PASSWORD`
  - `KEYCHAIN_PASSWORD`
  - `APPLE_ID`
  - `APPLE_PASSWORD`
  - `APPLE_TEAM_ID`
  - `OSX_SIGN_IDENTITY`
  - `OSX_SIGN_IDENTITY_MAS`
  - `SIGNPATH_API_TOKEN`
- `scraper-deploy.yml`
  - `VPS_HOST`
  - `VPS_USER`
  - `VPS_SSH_KEY`
- `similar-issues.yml`
  - `USER_PAT`
  - `GITHUB_TOKEN`
- `issue-labeler.yml`
  - `GITHUB_TOKEN`
- `translator.yml`
  - `GITHUB_TOKEN`
- `tag.yml`
  - `GITHUB_TOKEN` for remote tag push / workflow dispatch

### Non-Secret Local Blockers

- Local Node version is `20.13.1`, but repo `.nvmrc` is `22`
- `tsx` commands that create IPC pipes fail in this sandbox with `listen EPERM`
  - this blocked:
    - `apps/ssr` post-build scripts
    - `apps/desktop` `update:main-hash`
- Local Xcode installation is not healthy enough for simulator compilation
  - `IDESimulatorFoundation` plugin load failure
- `docker` is not installed
- repo has no git tags in this clone, so `git describe --tags` returns nothing
- `apps/api` tests are coupled to PostgreSQL from local env/config and cannot pass offline in this workspace

### Repo Issues Worth Fixing

- Desktop/web renderer build logs a PostCSS lexical error against `packages/internal/components/assets/index.css`
- Desktop renderer build logs a route generation warning because `layer/renderer/src/pages/(main)/index.sync.tsx` does not export `handle`
- `lint.yml` is effectively coupled to a newer Node runtime because `tsslint` uses `fs.globSync`
