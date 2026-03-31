# `build-ios-development.yml`

## Function

Builds iOS development artifacts for physical devices and simulator targets.

## Trigger

- Push to any branch when mobile app implementation files change:
  - `apps/mobile/web-app/**`
  - `apps/mobile/native/**`
  - `apps/mobile/package.json`
  - `apps/mobile/app.config.ts`

## Affected Modules

- `apps/mobile`
- iOS native build path
- Expo / EAS development client setup

## Inputs, Secrets, Environment

- Secret: `RUNNER_GITHUB_TOKEN`
- Secret: `EXPO_TOKEN`
- Secret: `RN_SENTRY_AUTH_TOKEN`

## Flow Logic

1. Run `check-runner` on Ubuntu.
2. Query GitHub runner availability through the Actions API.
3. If an idle self-hosted macOS runner exists:
   - route device IPA build to `[self-hosted, macOS]`
4. Otherwise:
   - use `macos-latest`
5. For device builds:
   - checkout code
   - optionally setup Xcode on GitHub-hosted macOS
   - setup pnpm and Node on GitHub-hosted macOS
   - login to EAS
   - install dependencies
   - run `eas build --platform ios --profile development --local`
   - upload `build.ipa`
6. For simulator builds:
   - always use `macos-latest`
   - setup Xcode, pnpm, Node, and EAS
   - install dependencies
   - run `eas build --platform ios --profile ios-simulator --local`
   - upload simulator IPA
7. On self-hosted device build, clear Xcode DerivedData after completion.

## Outputs and Side Effects

- Development IPA for real devices
- Simulator IPA for local QA or internal testing

## Notes

- The runner-selection job is a routing layer, not a build layer.
- This workflow is focused on development distribution, not App Store submission.
