# Flash Mobile — Android-First Release Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the Flash mobile app building on Android and ship APKs via GitHub Releases, with iOS build verification in CI.

**Architecture:** Fork the upstream Folo/Follow mobile app (Expo 53 + React Native), rebrand to Flash with own bundle IDs, point to own API at `api.scflash.win`, and set up a GitHub Actions release pipeline that builds APKs on version tags.

**Tech Stack:** Expo 53, React Native 0.79, EAS CLI (local builds), GitHub Actions, Firebase (own project), Sentry (own project or disabled)

---

## Prerequisites (Manual — User Does These)

See `docs/superpowers/plans/2026-03-13-flash-mobile-prerequisites.md` for the full checklist with details. Summary:

1. Create EAS account (free)
2. Create Firebase project + download config files
3. Set GitHub Secrets (`EXPO_TOKEN` required; `RN_SENTRY_AUTH_TOKEN`, `RUNNER_GITHUB_TOKEN` optional — see full checklist for details)
4. Prepare branding assets
5. Update OAuth callback URLs to `api.scflash.win`

---

## Chunk 1: App Identity & Configuration

### Task 1: Update bundle identifiers and app identity

**Files:**

- Modify: `apps/mobile/app.config.ts`

- [ ] **Step 1: Change app name, slug, and owner**

In `apps/mobile/app.config.ts`, update these fields:

```typescript
// Line 29: Change owner
owner: "scflash",  // your EAS username

// Line 41-42: Change name and slug
name: "Flash",
slug: "flash",
```

- [ ] **Step 2: Change bundle identifiers**

```typescript
// Line 51: iOS bundle ID
bundleIdentifier: "win.scflash.app",

// Line 66: Android package
package: "win.scflash.app",
```

- [ ] **Step 3: Change URL scheme**

```typescript
// Line 46: Update scheme
scheme: ["flash", "scflash"],
```

- [ ] **Step 4: Update EAS project ID**

After running `eas init` (prerequisite), replace the project ID:

```typescript
// Line 26: Replace with your EAS project ID
projectId: "<your-eas-project-id>",
```

- [ ] **Step 5: Update Sentry config (or remove)**

In `app.config.ts` lines 141-147, either update to own Sentry org/project or remove the plugin:

```typescript
// Option A: Update to own Sentry
[
  "@sentry/react-native/expo",
  {
    url: "https://sentry.io/",
    project: "flash-mobile",
    organization: "scflash",
  },
],

// Option B: Remove Sentry plugin entirely (fastest path)
// Delete lines 140-147 from plugins array
```

- [ ] **Step 6: Replace branding assets**

Copy your branding assets (from prerequisites) into `apps/mobile/assets/`:

- `icon.png` → `apps/mobile/assets/icon.png`
- `adaptive-icon.png` → `apps/mobile/assets/adaptive-icon.png`
- `splash-icon.png` → `apps/mobile/assets/splash-icon.png`

If you don't have custom assets yet, skip this step — the upstream icons will work for initial build testing.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app.config.ts apps/mobile/assets/
git commit -m "chore(mobile): rebrand to Flash with own bundle IDs"
```

**Important:** Changing `name` to "Flash" means `expo prebuild` will generate an iOS workspace named `Flash.xcworkspace` and scheme `Flash`. The CI workflow's iOS build check step references these names — if you choose a different app name, update the workflow accordingly.

---

### Task 2: Update EAS configuration

**Files:**

- Modify: `apps/mobile/eas.json`

- [ ] **Step 1: Remove upstream submit configuration**

The `submit.production` section references the upstream developer's Apple Team ID (`492J8Q67PF`), Apple ID (`diygod@rss3.io`), and Android release config (`releaseStatus: "draft"`). Remove the entire `submit` block:

```json
{
  "cli": {
    "version": ">= 15.0.10",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "env": {
        "PROFILE": "development"
      }
    },
    "ios-simulator": {
      "extends": "development",
      "ios": {
        "simulator": true
      },
      "env": {
        "PROFILE": "ios-simulator"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "env": {
        "PROFILE": "preview"
      }
    },
    "production": {
      "autoIncrement": true,
      "channel": "production",
      "env": {
        "PROFILE": "production"
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/eas.json
git commit -m "chore(mobile): remove upstream submit config from eas.json"
```

---

### Task 3: Point API URLs to own deployment

**Files:**

- Modify: `packages/internal/shared/src/env.common.ts`

The mobile app reads API URLs from this file via `proxyEnv` (see `apps/mobile/src/lib/proxy-env.ts`). The `prod` profile is used for release builds.

- [ ] **Step 1: Update production URLs**

In `packages/internal/shared/src/env.common.ts`, change the `PROD` block:

```typescript
export const DEFAULT_VALUES = {
  PROD: {
    API_URL: "https://api.scflash.win",
    WEB_URL: "https://app.scflash.win",
    INBOXES_EMAIL: "@scflash.win",
    OPENPANEL_CLIENT_ID: "",
    OPENPANEL_API_URL: "",
    RECAPTCHA_V3_SITE_KEY: "",
    HCAPTCHA_SITE_KEY: "",
    POSTHOG_KEY: "",
    POSTHOG_HOST: "",
  },
  // ... keep DEV, STAGING, LOCAL as-is or update similarly
```

Note: Empty strings for analytics keys effectively disables those services until you set up your own. The app handles missing keys gracefully — analytics calls become no-ops.

- [ ] **Step 2: Update WebView host whitelist**

In `apps/mobile/src/hooks/useWebViewNavigation.tsx` line 9:

```typescript
const allowHosts = new Set(["app.scflash.win", "scflash.win"])
```

- [ ] **Step 3: Commit**

```bash
git add packages/internal/shared/src/env.common.ts apps/mobile/src/hooks/useWebViewNavigation.tsx
git commit -m "chore: point API URLs to scflash.win deployment"
```

---

### Task 4: Brand/domain audit — update all hardcoded Follow/Folo references

**Files:**

- Modify: `apps/mobile/src/lib/op.ts`
- Modify: `apps/mobile/src/modules/login/index.tsx`
- Modify: `apps/mobile/src/modules/settings/routes/Privacy.tsx`
- Modify: `apps/mobile/src/screens/(modal)/ProfileScreen.tsx`
- Modify: `packages/internal/constants/src/app.ts`
- Modify: `packages/internal/utils/src/headers.ts`
- Modify: `apps/mobile/package.json`

The plan's API URL changes (Task 3) only cover `env.common.ts` and WebView hosts. Multiple other files hardcode `folo.is`, `app.folo.is`, `is.follow`, or display "Folo" as the app name. These will cause broken share URLs, wrong origin checks, and stale branding if not updated.

- [ ] **Step 1: Update OpenPanel origin**

In `apps/mobile/src/lib/op.ts` line 9:

```typescript
// Change from:
Origin: "https://app.folo.is",
// To:
Origin: "https://app.scflash.win",
```

- [ ] **Step 2: Update login screen branding and legal links**

In `apps/mobile/src/modules/login/index.tsx`:

```typescript
// Line 58: App name display
<Text className="text-3xl font-bold">Flash</Text>

// Line 124: Terms of service URL
onPress={() => Linking.openURL("https://scflash.win/terms-of-service")}

// Line 131: Privacy policy URL
onPress={() => Linking.openURL("https://scflash.win/privacy-policy")}
```

- [ ] **Step 3: Update settings legal links**

In `apps/mobile/src/modules/settings/routes/Privacy.tsx`:

```typescript
// Line 24:
Linking.openURL("https://scflash.win/terms-of-service")

// Line 30:
Linking.openURL("https://scflash.win/privacy-policy")
```

- [ ] **Step 4: Update profile share URL**

In `apps/mobile/src/screens/(modal)/ProfileScreen.tsx`:

```typescript
// Line 96:
const shareUrl = `https://app.scflash.win/share/users/${user.id}`

// Line 100:
title: `Flash | ${user.name}'s Profile`,
```

- [ ] **Step 5: Update app constants**

In `packages/internal/constants/src/app.ts`:

```typescript
// Line 2: Update package ID
export const GOOGLE_PLAY_PACKAGE_ID = "win.scflash.app"
```

- [ ] **Step 6: Update HTTP headers and origin checks**

In `packages/internal/utils/src/headers.ts`:

```typescript
// Line 33: Origin check
(headers.Referer && headers.Referer !== "app://scflash.win") ||
(headers.Origin && headers.Origin !== "app://scflash.win")

// Lines 101, 115, 118: X-App-Name headers
"X-App-Name": "Flash Web"
"X-App-Name": "Flash SSR"
"X-App-Name": "Flash Mobile"
```

- [ ] **Step 7: Update package.json app name**

In `apps/mobile/package.json`, update the `appName` field:

```json
"appName": "Flash",
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/lib/op.ts apps/mobile/src/modules/login/index.tsx \
  apps/mobile/src/modules/settings/routes/Privacy.tsx \
  "apps/mobile/src/screens/(modal)/ProfileScreen.tsx" \
  packages/internal/constants/src/app.ts packages/internal/utils/src/headers.ts \
  apps/mobile/package.json
git commit -m "chore: rebrand all hardcoded Follow/Folo references to Flash/scflash.win"
```

---

### Task 5: Replace Firebase config files

**Files:**

- Replace: `apps/mobile/build/google-services.json` (Android)
- Replace: `apps/mobile/build/GoogleService-Info.plist` (iOS)

Note: `app.config.ts` references these at `android.googleServicesFile: "./build/google-services.json"` and `ios.googleServicesFile: "./build/GoogleService-Info.plist"`.

- [ ] **Step 1: Verify build directory exists**

```bash
ls apps/mobile/build/
```

If it doesn't exist: `mkdir -p apps/mobile/build`

- [ ] **Step 2: Copy your Firebase config files**

Copy the files you downloaded from Firebase Console (prerequisite) into `apps/mobile/build/`:

- `google-services.json` (from Firebase Android app setup)
- `GoogleService-Info.plist` (from Firebase iOS app setup)

- [ ] **Step 3: Update Sentry DSN (if keeping Sentry)**

If you created your own Sentry project, update `apps/mobile/src/initialize/sentry.ts`:

```typescript
Sentry.init({
  dsn: "<your-sentry-dsn>",
  tracesSampleRate: 1,
})
```

If stripping Sentry entirely: leave the file as-is for now (the DSN will fail silently).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/build/google-services.json apps/mobile/build/GoogleService-Info.plist
git add apps/mobile/src/initialize/sentry.ts  # if changed
git commit -m "chore(mobile): replace Firebase config with own project"
```

---

## Chunk 2: Android Build Verification

### Task 6: Run EAS init and verify project linking

This task must be done locally on your machine. Note: `eas-cli` is already a devDependency in `apps/mobile/package.json`, so use `pnpm exec eas` instead of installing globally.

- [ ] **Step 1: Log in to EAS**

```bash
cd apps/mobile && pnpm exec eas login
```

- [ ] **Step 2: Initialize EAS project**

```bash
cd apps/mobile && pnpm exec eas init
```

This will create/link an EAS project and update the `projectId` in `app.config.ts` (done in Task 1 Step 4).

- [ ] **Step 3: Commit the project ID update if not already committed**

```bash
git add apps/mobile/app.config.ts
git commit -m "chore(mobile): link EAS project"
```

---

### Task 7: Regenerate native projects and attempt first Android build

The checked-in `apps/mobile/ios/` directory contains native files generated for the upstream "Folo" identity (e.g. `Folo.xcodeproj`). After changing the app name and bundle IDs, these must be regenerated. The `ios/` and `android/` directories in this repo are **generated artifacts** from `expo prebuild`, not hand-maintained source.

- [ ] **Step 1: Clean and regenerate native projects**

```bash
cd apps/mobile && npx expo prebuild --clean
```

This regenerates `ios/` and `android/` with the new app name "Flash" and bundle ID `win.scflash.app`. The old `Folo.xcodeproj` will be replaced with `Flash.xcodeproj`.

- [ ] **Step 2: Run expo doctor to check compatibility**

```bash
cd apps/mobile && npx expo-doctor
```

Fix any reported issues before proceeding.

- [ ] **Step 3: Attempt local preview build**

```bash
cd apps/mobile && pnpm exec eas build --platform android --profile preview --local --output=./flash.apk
```

This will likely fail the first time. Common issues and fixes:

| Error                          | Fix                                                                     |
| ------------------------------ | ----------------------------------------------------------------------- |
| JDK version mismatch           | Install JDK 17: `brew install openjdk@17`                               |
| Android SDK not found          | Install via Android Studio or `sdkmanager`                              |
| Gradle heap OOM                | The project already has `plugins/with-gradle-jvm-heap-size-increase.js` |
| Native module compile error    | Check if `expo-doctor` flagged version mismatches                       |
| Missing `google-services.json` | Ensure file is at `apps/mobile/build/google-services.json`              |

- [ ] **Step 3: Install and test APK**

If build succeeds, install on a connected Android device or emulator:

```bash
adb install ./flash.apk
```

Verify:

- App launches and shows the login/public timeline
- App name shows "Flash" (not "Folo")
- Can reach your API at `api.scflash.win`

- [ ] **Step 4: Back up the keystore**

After first successful build, EAS generates a keystore. Back it up:

```bash
pnpm exec eas credentials --platform android
```

Select "Download existing keystore" and save to a secure location (password manager, encrypted drive). Losing this keystore means you can never update the app for existing users.

---

## Chunk 3: GitHub Actions CI Updates

### Task 8: Extend existing build-android.yml to support tag-triggered releases

**Files:**

- Modify: `.github/workflows/build-android.yml`

Instead of creating a new workflow and disabling the existing ones, extend `build-android.yml` to also trigger on `mobile/v*` tags and create GitHub Releases. This preserves the existing push-triggered preview builds and manual dispatch while adding release capability.

- [ ] **Step 1: Add tag trigger to build-android.yml**

In `.github/workflows/build-android.yml`, add `tags` to the `push` trigger:

```yaml
on:
  push:
    branches:
      - "**"
    tags:
      - "mobile/v*"
    paths:
      - "apps/mobile/**"
      - "pnpm-lock.yaml"
  workflow_dispatch:
    inputs:
      profile:
        type: choice
        default: preview
        options:
          - preview
          - production
        description: "Build profile"
      release:
        type: boolean
        default: false
        description: "Create a release draft for the build"
```

- [ ] **Step 2: Always create GitHub Release on tag pushes**

The existing workflow already has a "Create Release Draft" step gated by `github.event.inputs.release == 'true'`. Update the condition to also trigger on tags. Replace the existing release steps (lines 90-107) with:

```yaml
- name: Setup Version
  if: github.event.inputs.release == 'true' || startsWith(github.ref, 'refs/tags/mobile/v')
  id: version
  uses: ./.github/actions/setup-version
  with:
    type: "mobile"

- name: Create Release
  if: github.event.inputs.release == 'true' || startsWith(github.ref, 'refs/tags/mobile/v')
  uses: softprops/action-gh-release@v2
  with:
    name: Flash Mobile v${{ steps.version.outputs.APP_VERSION }}
    draft: false
    prerelease: false
    tag_name: ${{ github.ref_name }}
    files: ${{ github.workspace }}/build.apk
    generate_release_notes: true
    body: |
      ## Install Instructions (Android)

      1. Download `build.apk` below
      2. On your Android device, enable "Install from unknown sources" in Settings > Security
      3. Open the downloaded APK to install
      4. Launch Flash and sign in

      **Minimum Android version:** 7.0 (API 24)
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-android.yml
git commit -m "ci(mobile): extend build-android to create GitHub Releases on version tags"
```

---

### Task 9: Add iOS simulator build check to build-ios.yml

**Files:**

- Modify: `.github/workflows/build-ios.yml`

The existing `build-ios.yml` does full EAS builds which require signing. Add a lightweight simulator-only job that runs `expo prebuild` + `xcodebuild` without signing, suitable for verifying iOS compiles without an Apple Developer account.

- [ ] **Step 1: Add a simulator check job**

In `.github/workflows/build-ios.yml`, add a new job before the existing ones:

```yaml
ios-compile-check:
  name: iOS Compile Check (simulator)
  runs-on: macos-latest
  steps:
    - name: 📦 Checkout code
      uses: actions/checkout@v5

    - name: 🔧 Setup Xcode
      uses: ./.github/actions/setup-xcode

    - name: 📦 Setup pnpm
      uses: pnpm/action-setup@v4

    - name: 🏗 Setup Node.js
      uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: "pnpm"

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: 🔨 Prebuild iOS
      working-directory: apps/mobile
      run: npx expo prebuild --platform ios --clean

    - name: 🔨 Build iOS (simulator, no signing)
      run: |
        xcodebuild build \
          -workspace apps/mobile/ios/Flash.xcworkspace \
          -scheme Flash \
          -sdk iphonesimulator \
          -configuration Release \
          CODE_SIGNING_ALLOWED=NO
```

Note: The workspace/scheme names (`Flash`) must match the `name` field in `app.config.ts`. If you change the app name, update these values.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/build-ios.yml
git commit -m "ci(mobile): add iOS simulator compile check job"
```

---

### Task 10: Update lint workflow environment variables

**Files:**

- Modify: `.github/workflows/lint.yml`

- [ ] **Step 1: Update API URLs in lint workflow**

In `.github/workflows/lint.yml` lines 7-9, update the environment variables:

```yaml
env:
  VITE_WEB_URL: https://app.scflash.win
  VITE_API_URL: https://api.scflash.win
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/lint.yml
git commit -m "ci: update API URLs in lint workflow to scflash.win"
```

---

## Chunk 4: First Release

### Task 11: Test the release pipeline end-to-end

- [ ] **Step 1: Push all changes to main**

```bash
git push origin main
```

Verify the lint workflow passes on push.

- [ ] **Step 2: Create a release tag**

```bash
git tag mobile/v0.3.0
git push origin mobile/v0.3.0
```

- [ ] **Step 3: Monitor the GitHub Actions run**

Go to your repo's Actions tab. Verify:

- Lint & Typecheck job passes
- iOS Build Check job passes (prebuild + xcodebuild simulator build, no signing required)
- Build Android APK job produces an APK
- GitHub Release is created with the APK attached

- [ ] **Step 4: Download and test the release APK**

Download the APK from the GitHub Release page. Install on an Android device and verify:

- App installs and launches
- Shows "Flash" as app name
- Public timeline loads data from `api.scflash.win`
- Login flow works
- Basic navigation (tabs, feed details) works

- [ ] **Step 5: Fix any issues and re-release**

If issues are found, fix them, bump version, and re-tag:

```bash
# Fix issues, then:
# Update version in apps/mobile/package.json
git add -A && git commit -m "fix(mobile): <description>"
git tag mobile/v0.3.1
git push origin main mobile/v0.3.1
```

---

## File Map Summary

| File                                                  | Action            | Purpose                                                     |
| ----------------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| `apps/mobile/app.config.ts`                           | Modify            | Bundle ID, name, slug, owner, EAS project ID, Sentry config |
| `apps/mobile/eas.json`                                | Modify            | Remove upstream submit config                               |
| `apps/mobile/package.json`                            | Modify            | Update `appName` to Flash                                   |
| `packages/internal/shared/src/env.common.ts`          | Modify            | Point API URLs to scflash.win                               |
| `packages/internal/constants/src/app.ts`              | Modify            | Update Google Play package ID                               |
| `packages/internal/utils/src/headers.ts`              | Modify            | Update origin checks and X-App-Name headers                 |
| `apps/mobile/src/hooks/useWebViewNavigation.tsx`      | Modify            | Update WebView host whitelist                               |
| `apps/mobile/src/lib/op.ts`                           | Modify            | Update OpenPanel origin                                     |
| `apps/mobile/src/modules/login/index.tsx`             | Modify            | Update branding and legal URLs                              |
| `apps/mobile/src/modules/settings/routes/Privacy.tsx` | Modify            | Update legal URLs                                           |
| `apps/mobile/src/screens/(modal)/ProfileScreen.tsx`   | Modify            | Update share URL and title                                  |
| `apps/mobile/build/google-services.json`              | Replace           | Own Firebase config (Android)                               |
| `apps/mobile/build/GoogleService-Info.plist`          | Replace           | Own Firebase config (iOS)                                   |
| `apps/mobile/src/initialize/sentry.ts`                | Modify (optional) | Own Sentry DSN or leave as-is                               |
| `.github/workflows/build-android.yml`                 | Modify            | Add tag trigger + GitHub Release creation                   |
| `.github/workflows/build-ios.yml`                     | Modify            | Add iOS simulator compile check job                         |
| `.github/workflows/lint.yml`                          | Modify            | Update API URLs to scflash.win                              |
