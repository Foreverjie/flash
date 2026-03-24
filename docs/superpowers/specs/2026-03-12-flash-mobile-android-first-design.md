# Flash Mobile — Android-First Release via GitHub Releases

**Date:** 2026-03-12
**Author:** Solo developer
**Status:** Approved

## Overview

Ship Flash as an Android app distributed via GitHub Releases (free), with iOS build verification via CI. No paid store accounts required for Phase 1. Upgrade to App Store and Google Play when market traction is validated.

## Goals

- Get the existing Expo mobile codebase building successfully on Android
- Distribute Android APK to real users at zero cost
- Verify iOS compiles on every commit so it's ready when Apple Developer account is acquired
- Automate the build-and-release pipeline so shipping is a `git tag` away

## Non-Goals (Phase 1)

- iOS distribution (requires $99/year Apple Developer account)
- Google Play Store listing (requires $25 + 14-day closed testing)
- In-app purchases or subscription infrastructure
- F-Droid distribution
- OTA updates via EAS Update

## Distribution Strategy

### Phase 1: Free Distribution (Now)

| Platform | Build Tool                                            | Distribution                       | Cost |
| -------- | ----------------------------------------------------- | ---------------------------------- | ---- |
| Android  | EAS local builds via GitHub Actions (free, unlimited) | GitHub Releases (APK sideload)     | $0   |
| iOS      | GitHub Actions (macos runner)                         | None — simulator verification only | $0   |

### Phase 2: Store Distribution (When Validated)

| Platform | Distribution      | Cost         | Prerequisite                                    |
| -------- | ----------------- | ------------ | ----------------------------------------------- |
| Android  | Google Play Store | $25 one-time | 14-day closed testing with 12+ testers          |
| iOS      | Apple App Store   | $99/year     | Apple Developer enrollment (up to 48h approval) |

## Accounts Required

**Phase 1 (free):**

- EAS account at expo.dev — link to GitHub repo (needed for `eas build --local` CLI and keystore management)

**Phase 2 (paid, deferred):**

- Google Play Developer ($25 one-time)
- Apple Developer Program ($99/year)

## Build Configuration

### Android APK (Distributable)

- EAS build profile: `preview` with `--local` flag (produces APK, not AAB). The existing `production` profile produces AAB which is Play Store only and cannot be sideloaded.
- Signing: EAS manages keystores automatically; back up the keystore after first successful build for continuity
- Target: `compileSdkVersion 35`, `minSdkVersion 24` (Android 7+, ~95% device coverage)
- Builds run locally on GitHub Actions runner — free and unlimited, no EAS remote build quota consumed

### iOS Simulator (Verification Only)

- Runs on GitHub Actions `macos-latest` runner
- `npx expo prebuild --platform ios --clean`
- `xcodebuild build` targeting `iphonesimulator` SDK
- No code signing needed for simulator builds
- Workspace and scheme names are derived from the `name` field in `app.config.ts` (e.g. if name is "Flash", workspace is `Flash.xcworkspace`, scheme is `Flash`)

## Existing CI Infrastructure

The repository already has working GitHub Actions workflows that this design builds upon:

- `.github/workflows/build-android.yml` — Android local builds with JDK 17, Android SDK, preview/production profiles
- `.github/workflows/build-ios.yml` — iOS local builds with self-hosted runner fallback
- `.github/workflows/lint.yml` — Lint checks

The main change is adding a **release workflow** that triggers on version tags and creates GitHub Releases with the APK attached.

## CI Pipeline (GitHub Actions)

**Triggers:**

- Push to `main` / PRs → lint, typecheck, iOS build check
- Tag `mobile/v*` (e.g. `mobile/v0.3.0`) → all of the above + Android APK build + GitHub Release

**Concurrency:** Cancel in-progress runs for the same branch/tag (matches existing workflow pattern).

### Job 1: Lint & Typecheck (ubuntu-latest, ~2 min)

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v6
    with:
      node-version: 22
      cache: pnpm
  - run: pnpm install --frozen-lockfile
  - run: pnpm run typecheck
  - run: pnpm run lint
```

### Job 2: iOS Build Check (macos-latest, ~10-15 min)

Note: Workspace and scheme names below are placeholders — they must match the `name` in `app.config.ts`.

```yaml
steps:
  - uses: actions/checkout@v5
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v6
    with:
      node-version: 22
      cache: pnpm
  - run: pnpm install --frozen-lockfile
  - working-directory: apps/mobile
    run: npx expo prebuild --platform ios --clean
  - run: |
      xcodebuild build \
        -workspace apps/mobile/ios/$APP_NAME.xcworkspace \
        -scheme $APP_NAME \
        -sdk iphonesimulator \
        -configuration Release \
        CODE_SIGNING_ALLOWED=NO
```

### Job 3: Android APK Release (ubuntu-latest, tag-triggered only)

Based on the existing `build-android.yml` workflow pattern — uses `--local` builds (free, unlimited).

```yaml
if: startsWith(github.ref, 'refs/tags/mobile/v')
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
steps:
  - uses: actions/checkout@v5
  - uses: pnpm/action-setup@v4
  - uses: actions/setup-node@v6
    with:
      node-version: 22
      cache: pnpm
  - uses: actions/setup-java@v5
    with:
      java-version: "17"
      distribution: "zulu"
  - uses: android-actions/setup-android@v3
  - uses: expo/expo-github-action@v8
    with:
      eas-version: latest
      token: ${{ secrets.EXPO_TOKEN }}
  - run: pnpm install
  - name: Build Android APK
    working-directory: apps/mobile
    run: eas build --platform android --profile preview --local --output=${{ github.workspace }}/flash.apk
  - uses: softprops/action-gh-release@v2
    with:
      files: ${{ github.workspace }}/flash.apk
      generate_release_notes: true
```

## Release Workflow

How to ship a new version:

1. Bump version in `apps/mobile/app.config.ts`
2. Commit: `git commit -m "chore(mobile): bump to v0.3.0"`
3. Tag: `git tag mobile/v0.3.0 && git push && git push --tags`
4. GitHub Actions automatically:
   - Runs lint and typecheck
   - Verifies iOS compiles on simulator
   - Builds Android APK locally on the runner (free)
   - Creates GitHub Release with APK attached
5. Share the release URL with users

## Pre-Build Fixes Required

Before the pipeline works, these issues must be resolved:

### 1. Bundle Identifier

Change from upstream `is.follow` to own identifier (e.g. `win.scflash.app`) in `apps/mobile/app.config.ts`. Affects both iOS and Android bundle IDs.

### 2. Firebase Configuration

The existing `google-services.json` and `GoogleService-Info.plist` belong to the upstream project. Options:

- **Option A:** Create own Firebase project and replace config files
- **Option B:** Strip Firebase dependencies for v1 (removes analytics, push notifications, app-check)

Recommendation: Option A if push notifications are desired; Option B for fastest path to building.

### 3. Environment / API Configuration

API URL and auth configuration must point to own deployment (`api.scflash.win`). Check:

- `apps/mobile/src/lib/env.ts` or equivalent
- Any hardcoded upstream API URLs
- Auth callback URLs for OAuth providers

### 4. EAS Project Linking

Run `eas init` in `apps/mobile/` to create a new EAS project linked to own Expo account. This replaces the upstream project ID in `app.config.ts`.

### 5. Android Build Smoke Test

Run `eas build --platform android --profile preview --local` early to surface native dependency issues (missing SDKs, Gradle version conflicts, native module compilation errors). Fix iteratively.

### 6. App Identity

Update in `app.config.ts`:

- `name`: App display name
- `slug`: URL-safe identifier
- `icon`, `splash`, `adaptiveIcon`: Own branding assets

## Phase 2 Upgrade Path

### Google Play

1. Create developer account ($25)
2. Build AAB with `production` profile: `eas build --platform android --profile production --local`
3. Upload AAB to closed testing track (Play Store requires AAB, not APK)
4. Recruit 12+ testers (friends, communities, social media)
5. Wait 14 days (mandatory for new developer accounts)
6. Submit to production review
7. Update CI: add `eas submit --platform android` after build (matches existing workflow pattern)

### Apple App Store

1. Create Apple Developer account ($99/year, up to 48h enrollment)
2. Prepare App Store assets: screenshots (6.7", 6.5", 5.5" devices), description, privacy policy URL, app category
3. EAS submit handles most of the upload process
4. Update CI: switch from simulator build to `eas build --platform ios --profile production --local` + `eas submit --platform ios`

### CI Updates for Phase 2

- Add `APPLE_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8` secrets for iOS submission
- Add Play Store service account JSON secret for Android submission
- Change Android release build from `preview` (APK) to `production` (AAB)
- Add `eas submit` steps after successful builds

## Architecture Notes

The existing mobile codebase is mature:

- **53 screens** with full bottom-tab navigation
- **Offline-first** with SQLite via expo-sqlite + Drizzle ORM
- **Shared packages** (store, hooks, atoms, types, constants, database, models) work cross-platform
- **Platform resolution** via Metro `.rn.ts` file convention
- **Auth** via Better Auth with expo adapter (email/password, GitHub, Google, Apple)

No architectural changes needed. The work is primarily build configuration, identity/branding, and CI setup.

## Risk Mitigation

| Risk                                       | Mitigation                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| Native build failures from upstream deps   | Pin Expo SDK version, use `expo doctor` to check compatibility              |
| Users can't find/install APK               | Clear install instructions in GitHub Release notes, link from web app       |
| Keystore loss between builds               | Export and back up EAS keystore after first successful build                |
| iOS diverges while Android-only            | CI verifies iOS compiles on every push to main                              |
| Large APK size for sideloaded distribution | Monitor APK size; target under 100 MB to keep sideload downloads reasonable |
