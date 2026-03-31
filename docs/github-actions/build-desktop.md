# `build-desktop.yml`

## Function

Builds the desktop app for Linux, macOS, and Windows, with optional store-signing and release automation.

## Trigger

- Push to any branch when desktop code, shared packages, lockfile, or this workflow file changes
- Manual `workflow_dispatch`

## Affected Modules

- `apps/desktop`
- `packages/**`
- Shared web renderer build path used by desktop
- Desktop release packaging and signing configuration

## Inputs, Secrets, Environment

- Workflow input: `tag_version`
- Workflow input: `store`
- Workflow input: `build_version`
- Vars: `VITE_WEB_URL`, `VITE_API_URL`, `VITE_SENTRY_DSN`, `VITE_OPENPANEL_CLIENT_ID`, `VITE_OPENPANEL_API_URL`, `VITE_FIREBASE_CONFIG`
- Secret: `SENTRY_AUTH_TOKEN`
- macOS signing secrets:
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
- Windows signing secret:
  - `SIGNPATH_API_TOKEN`

## Flow Logic

1. Expand a build matrix across `macos-latest`, `ubuntu-latest`, and `windows-latest`.
2. Derive two flags:
   - `PROD`: release-like build or store build
   - `RELEASE`: tagged release flow
3. Checkout full history for release builds, shallow history otherwise.
4. Setup pnpm and Node 22.
5. On macOS:
   - install `python-setuptools`
   - install `appdmg`
   - optionally import Apple certificates and provisioning profile into a temporary keychain
6. Install dependencies.
7. On Windows, prebuild workspace packages.
8. In `apps/desktop`, update main hash.
9. Build the desktop app with `electron-vite`.
10. Build platform-specific installers:
    - Linux and normal Windows: `electron-forge make`
    - macOS: build x64 and arm64 DMGs, then merge update YAML
    - Mac App Store: build MAS package
    - Microsoft Store: build MS package
11. On Linux, also build renderer-only artifacts.
12. Upload generated artifacts per platform.
13. On release Windows builds, submit the unsigned EXE to SignPath.
14. Update `latest.yml` after Windows release signing.

## Outputs and Side Effects

- macOS DMG or MAS PKG artifacts
- Windows EXE artifacts
- Linux renderer artifacts
- Optional signed Windows output flow

## Notes

- This is the most environment-heavy workflow in the repo.
- It combines app build, packaging, signing, and release-channel metadata generation.
