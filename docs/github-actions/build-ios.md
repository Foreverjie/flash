# `build-ios.yml`

## Function

Performs iOS compile validation and builds production or preview IPA artifacts, with optional App Store submission.

## Trigger

- Push to any branch when `apps/mobile/**` or `pnpm-lock.yaml` changes
- Manual `workflow_dispatch`

## Affected Modules

- `apps/mobile`
- iOS native project generation and compilation
- Expo / EAS iOS release flow

## Inputs, Secrets, Environment

- Workflow input: `profile`
- Secret: `RUNNER_GITHUB_TOKEN`
- Secret: `EXPO_TOKEN`
- Secret: `RN_SENTRY_AUTH_TOKEN`

## Flow Logic

1. Run `ios-compile-check` on `macos-latest`.
2. In compile check:
   - checkout code
   - setup Xcode via local composite action
   - setup pnpm and Node 22
   - install dependencies with `--frozen-lockfile`
   - run `npx expo prebuild --platform ios --clean`
   - compile the app for simulator with `xcodebuild` and signing disabled
3. Run `check-runner` to decide between self-hosted macOS and GitHub-hosted macOS.
4. Build IPA on the selected runner:
   - checkout code
   - setup Xcode if GitHub-hosted
   - setup pnpm and Node if GitHub-hosted
   - authenticate EAS
   - install dependencies
   - run `eas build --platform ios --profile <profile> --local`
   - upload IPA artifact
5. If profile is `production`, submit the generated IPA to App Store Connect with `eas submit`.
6. If self-hosted runner is used, clear Xcode cache after build.

## Outputs and Side Effects

- iOS IPA artifact
- Optional App Store submission for production builds

## Notes

- This workflow has two layers:
  - a compile-sanity stage using generated native code
  - a release artifact stage using EAS local build
