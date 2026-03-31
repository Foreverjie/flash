# `build-android.yml`

## Function

Builds the Android mobile app through EAS local build and optionally publishes a release artifact.

## Trigger

- Push to any branch when mobile files or `pnpm-lock.yaml` change
- Push tags matching `mobile/v*`
- Manual `workflow_dispatch`

## Affected Modules

- `apps/mobile`
- Root workspace dependency graph through `pnpm install`
- Release flow when a mobile tag is used

## Inputs, Secrets, Environment

- Workflow input: `profile`
- Workflow input: `release`
- Secret: `EXPO_TOKEN`

## Flow Logic

1. Checkout repository.
2. Setup pnpm, Node 22, JDK 17, and Android SDK.
3. Authenticate EAS with `EXPO_TOKEN`.
4. Install workspace dependencies with `pnpm install`.
5. Run `eas build --platform android --local` in `apps/mobile`.
6. Upload `build.apk` for non-production profiles.
7. Upload `build.aab` for production profile.
8. If manual release is enabled or the ref is a `mobile/v*` tag:
   - resolve app version via local composite action `setup-version`
   - create a GitHub release with the generated APK

## Outputs and Side Effects

- Android APK or AAB artifact
- Optional GitHub release entry for tagged or manual release builds

## Notes

- This pipeline depends on Expo build credentials being available to EAS.
- Production and preview paths diverge only after the build output stage.
