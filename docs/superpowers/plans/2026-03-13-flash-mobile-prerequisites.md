# Flash Mobile — Prerequisites Checklist

Complete these before starting the implementation plan at `2026-03-13-flash-mobile-android-first.md`.

---

## Accounts

- [ ] **Create EAS account** — Sign up at [expo.dev](https://expo.dev) (free)
  - Note your EAS username (used as `owner` in `app.config.ts`)
  - Generate an access token at Account Settings > Access Tokens

- [ ] **Create Firebase project** — At [console.firebase.google.com](https://console.firebase.google.com)
  - [ ] Add an **Android app** with package name `win.scflash.app`
  - [ ] Download `google-services.json`
  - [ ] Add an **iOS app** with bundle ID `win.scflash.app`
  - [ ] Download `GoogleService-Info.plist`
  - Both files go into `apps/mobile/build/`

- [ ] **(Optional) Create Sentry project** — At [sentry.io](https://sentry.io) if you want crash reporting
  - Create a React Native project
  - Note the DSN, org name, and project name
  - If skipping: the upstream DSN will fail silently, no harm done

---

## GitHub Secrets

Set these in your repo: Settings > Secrets and variables > Actions

| Secret                 | Required                               | Source                                      | Used by                                 |
| ---------------------- | -------------------------------------- | ------------------------------------------- | --------------------------------------- |
| `EXPO_TOKEN`           | Yes                                    | expo.dev > Account Settings > Access Tokens | EAS builds in CI                        |
| `RN_SENTRY_AUTH_TOKEN` | Only if keeping Sentry                 | sentry.io > Settings > Auth Tokens          | iOS build workflow (source maps upload) |
| `RUNNER_GITHUB_TOKEN`  | Only if using self-hosted macOS runner | GitHub PAT with `actions:read` scope        | iOS workflow's runner selection logic   |

Note: Apple/Google store submission secrets (`APPLE_ID`, `ASC_KEY_ID`, Play Store service account JSON) are **not needed for Phase 1** — only required when upgrading to store distribution.

---

## OAuth Callback URLs

Update callback/redirect URLs in each OAuth provider's dashboard to point to your API:

- [ ] **GitHub OAuth App** — Settings > Developer settings > OAuth Apps
  - Authorization callback URL: `https://api.scflash.win/api/auth/callback/github`

- [ ] **Google OAuth** — Google Cloud Console > APIs & Services > Credentials
  - Authorized redirect URI: `https://api.scflash.win/api/auth/callback/google`

- [ ] **Apple Sign-In** — Apple Developer > Certificates, Identifiers & Profiles
  - Return URL: `https://api.scflash.win/api/auth/callback/apple`
  - Note: Apple Sign-In requires Apple Developer account ($99/year) — skip for Phase 1 if not enrolled

---

## Branding Assets

Prepare these images (can use placeholders initially — upstream icons work for build testing):

- [ ] `icon.png` — 1024x1024, app icon for both platforms
- [ ] `adaptive-icon.png` — 1024x1024, Android adaptive icon foreground layer
- [ ] `splash-icon.png` — splash screen icon
- [ ] `icon-dev.png` — (optional) dev build icon variant
- [ ] `icon-staging.png` — (optional) staging/preview build icon variant

Place into `apps/mobile/assets/`

---

## Local Development Tools

For local Android builds (Task 7 in the plan):

- [ ] **JDK 17** — `brew install openjdk@17` (macOS) or download from [Adoptium](https://adoptium.net)
- [ ] **Android SDK** — Install via [Android Studio](https://developer.android.com/studio) or standalone SDK manager
  - Ensure `ANDROID_HOME` / `ANDROID_SDK_ROOT` environment variable is set
- [ ] **Android device or emulator** for testing the APK
  - Physical device: enable USB debugging + "Install from unknown sources"
  - Emulator: Android Studio > Virtual Device Manager

---

## Legal Pages (Optional but Recommended)

The mobile app links to Terms of Service and Privacy Policy. Set these up at your domain:

- [ ] `https://scflash.win/terms-of-service`
- [ ] `https://scflash.win/privacy-policy`

If not ready yet, the links will simply 404 — not a build blocker.
