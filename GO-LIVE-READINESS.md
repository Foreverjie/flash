# Flash — Go-Live Readiness Assessment

**Date:** 2026-03-31
**Branch:** `feat/mobile-web-account-drawer`
**Commit count:** ~50 commits on main

---

## 1. Current Implementation Overview

Flash is a fork of [RSSNext/Follow](https://github.com/RSSNext/follow), an RSS/content aggregation platform. Monorepo with 4 apps and 12 shared packages, managed by pnpm workspaces + Turborepo.

### Architecture

| Layer           | Tech                                                      | Deploy Target                          |
| --------------- | --------------------------------------------------------- | -------------------------------------- |
| API             | Hono.js, Drizzle ORM, Supabase PostgreSQL                 | Vercel Serverless                      |
| Auth            | Better Auth (email/password, GitHub, Google, 2FA, Stripe) | Mounted on API                         |
| Web/Desktop     | Vite + React 19, Electron 38                              | Vercel (web), Electron Forge (desktop) |
| Mobile (native) | Expo 53, React Native                                     | EAS Build (Android APK, iOS)           |
| Mobile (web)    | Responsive web layout within desktop app                  | Vercel (same as web)                   |
| SSR             | Fastify 5 + React 19, Satori OG images                    | Vercel                                 |
| Scraper         | Python (Scrapling), Docker                                | Self-hosted VPS                        |

### Database Schema (7 core tables)

- `users` — accounts with handle, bio, social links, role, ban fields
- `sessions` — Better Auth sessions with IP/UA tracking
- `accounts` — OAuth provider connections
- `verifications` — email verification & password reset tokens
- `feeds` — RSS sources with adapter config, sync metadata
- `posts` — fetched entries with formatted content, media, scrape status
- `subscriptions` — user-to-feed with custom title, category, tags
- `comments` — threaded comments on posts
- `read_status` — per-user read/unread tracking
- `two_factors` — 2FA backup codes and secrets

---

## 2. Implemented Features

### API (fully functional)

- Sign up, sign in, email verification, password reset
- OAuth (GitHub, Google), 2FA, anonymous sessions, admin plugin
- Stripe integration for billing
- Feed CRUD, RSS parsing, adapter system (Bilibili, X/Twitter timelines)
- Auto-sync via Vercel cron (daily at 08:00 UTC)
- Subscription management with custom titles, categories, tags
- Authenticated timeline with pagination and filtering
- Public timeline (no auth required)
- Read/unread status tracking, bulk mark-all-read
- Threaded comments with CRUD
- Background scrape queue for post detail content
- Scrapling service integration (internal API)
- Global error handling (404/500), structured JSON responses
- CORS configured for production domains + Vercel previews
- Rate limiting via Better Auth (100 req/min)
- Zod validation on auth, feed creation, comment creation
- Hono request logging

### Web/Desktop (largely inherited from Follow)

- 40 feature modules: feed browsing, entry reading, discover, explore, settings, AI chat, player, subscriptions, achievements, wallet, profile, etc.
- 14 settings tabs: general, appearance, feeds, notifications, data control, shortcuts, AI, integrations, plan/billing, invitations, referral, about
- Auth UI: login modal, sign-up, password reset, 2FA, referral code
- 9+ third-party integrations: Eagle, Readwise, Instapaper, Pocket, Obsidian, Outline, Readeck, Cubox, Zotero
- Sentry error tracking configured
- PostHog + GA4 analytics
- i18n: 4 languages (en, zh-CN, zh-TW, ja)
- Offline support: React Query persistence, network status indicator
- Mobile-web layout: tab bar, header, account drawer, view filter bar
- Keyboard shortcuts system
- Command palette
- Auto-update system (Electron)
- PWA support (web build)

### Mobile Native (Expo)

- Auth: login, sign-up, forgot password, 2FA, profile editing, Apple Sign-In
- Core screens: home tabs, discover, subscriptions, entry detail, feed detail, recommendations
- Onboarding: 4-step flow (welcome, preferences, interests, finished)
- Push notifications via Firebase Cloud Messaging
- Deep linking (`flash://`, `scflash://`)
- Firebase App Check (appAttest on iOS, playIntegrity on Android)
- Settings with offline sync queue
- Audio/video player
- Image lightbox with zoom/pan
- Sentry error tracking
- 4 locales (en, ja, zh-CN, zh-TW)

### SSR

- OG image generation (Satori + Resvg) for feeds, users, lists
- Share pages with meta tag injection
- Login/register/password-reset SSR pages
- CDN caching headers (1h max-age, stale-while-revalidate)
- XSS sanitization on user input in meta tags

### CI/CD (14 workflows)

- Web + SSR build (PR, push to main/dev)
- Desktop build (macOS, Windows, Linux with attestation)
- Android APK build on tag push, auto GitHub Release
- iOS simulator compile check + full IPA build
- ESLint + Prettier lint checks on PRs
- PR title validation
- Scraper CI (pytest) + Docker deploy to VPS
- i18n translator workflow
- Issue labeling + duplicate detection

---

## 3. Partially Implemented Features

| Feature                | Status                              | Gap                                                                                                        |
| ---------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mobile-web layout      | Active development (current branch) | Account drawer WIP, discover screen is a TODO placeholder, notification badge stubbed                      |
| 2FA TOTP verification  | Schema + UI exist                   | `apps/api/src/auth/plugins.ts:147` has `// TODO: Verify TOTP code` — verification not actually implemented |
| Achievement system     | UI module exists                    | `AchievementModalContent.tsx:34` has bare `// TODO`                                                        |
| Settings sync rollback | Sync queue exists                   | `sync-queue.ts:190` has `// TODO rollback or retry` — failures silently dropped                            |
| Scrape error recovery  | Basic retry exists                  | No dead-letter queue, max retry not configurable                                                           |
| Mobile unread badge    | UI placeholder exists               | `MobileTabBar.tsx:41` — hardcoded instead of real count                                                    |

---

## 4. Missing Features (Not Yet Implemented)

| Feature                             | Notes                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Push notifications (API side)       | No server-side push sending endpoint; FCM token saved but no send logic |
| Full-text search                    | No search API endpoint for posts/feeds                                  |
| User blocking/reporting             | No content moderation APIs                                              |
| Feed OPML export                    | Import exists in web UI, no export API                                  |
| API pagination hard limits          | No max limit enforcement to prevent abuse                               |
| Security headers on API             | No X-Content-Type-Options, HSTS, X-Frame-Options, CSP                   |
| Sentry on API server                | Desktop/web has Sentry; API has zero error tracking                     |
| API environment variable validation | No startup check for required env vars                                  |

---

## 5. Must-Have Items Before Go-Live

### P0 — Launch Blockers (fix before any deployment)

#### 5.1 Remove committed secrets from git history

**Files affected:**

- `apps/api/.env` — contains production Supabase PostgreSQL connection string with password, Supabase anon key (JWT), direct database IP (`74.48.6.101:5432`)
- `apps/desktop/.env` — contains commented-out GitHub PAT (`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`)

**Why:** Anyone with repo access (or if repo becomes public) has direct database access and a GitHub token. This is a critical security vulnerability.

**Action:**

1. Rotate all exposed credentials immediately (DB password, Supabase keys, GitHub PAT)
2. `git rm --cached apps/api/.env apps/desktop/.env`
3. Verify both are in `.gitignore` (they are listed but were committed before the ignore rule took effect)
4. Consider `git filter-branch` or BFG to purge from history

#### 5.2 Fix Vercel config domain references

**File:** `vercel.json` (root)

**Issue:** SSR rewrites point to upstream Follow domains (`app.follow.is`, `app.folo.is`, `dev.folo.is`, `staging.folo.is`) instead of Flash's `scflash.win`.

**Why:** Share pages, login, register, and password reset will redirect to the wrong service in production.

**Action:** Update all domain references to `scflash.win` equivalents, or deploy your own SSR instance and update the rewrite targets.

#### 5.3 Fix API cron path mismatch

**File:** `apps/api/vercel.json`

**Issue:** Vercel cron is configured for `/api/cron/sync-all`, but actual routes are `/cron/sync-feeds`, `/cron/enqueue-scrape`, `/cron/process-scrape`, `/cron/sync-all`.

**Why:** Scheduled feed sync will silently fail in production. Feeds won't update.

**Action:** Align the cron `path` in `vercel.json` with the actual route definitions. May need multiple cron entries or ensure `/api/cron/sync-all` maps correctly through the rewrite rules.

#### 5.4 Fix or disable 2FA TOTP verification

**File:** `apps/api/src/auth/plugins.ts:147`

**Issue:** TOTP verification is stubbed with `// TODO: Verify TOTP code`. If 2FA is enabled for a user, the verification step in account deletion is bypassed.

**Why:** Users who enable 2FA expect it to protect their account. A bypass defeats the security purpose.

**Action:** Either implement TOTP verification or remove the 2FA feature toggle from the UI until it's ready.

#### 5.5 Ensure email service works in production

**File:** `apps/api/src/lib/email.ts`

**Issue:** Without `RESEND_API_KEY` env var, verification and password reset emails are only logged to console.

**Why:** Users cannot verify their email or reset passwords without a working email provider.

**Action:** Set `RESEND_API_KEY` in Vercel production environment variables. Verify email delivery with a test account.

---

### P1 — Required for Safe Launch (fix within first sprint)

#### 5.6 Add security headers to API

**File:** `apps/api/src/index.ts`

**Issue:** No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, or Content Security Policy headers.

**Why:** Missing headers enable clickjacking, MIME sniffing attacks, and protocol downgrade attacks.

**Action:** Add Hono's built-in `secureHeaders()` middleware:

```typescript
import { secureHeaders } from "hono/secure-headers"
app.use("*", secureHeaders())
```

#### 5.7 Make cron auth fail-closed

**File:** `apps/api/src/routes/cron.ts:24-28`

**Issue:** If `CRON_SECRET` is not set, cron middleware falls through and allows unauthenticated access to sync/scrape endpoints.

**Why:** Anyone could trigger mass feed syncs or scrape operations, causing resource exhaustion.

**Action:** Reject cron requests if `CRON_SECRET` is not set in production (don't fall through):

```typescript
if (!cronSecret) {
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "CRON_SECRET not configured" }, 500)
  }
  return next()
}
```

#### 5.8 Add rate limiting to public API routes

**File:** `apps/api/src/index.ts`

**Issue:** Rate limiting only exists in Better Auth (auth endpoints). Feed, entry, subscription, and comment endpoints have no rate limiting.

**Why:** Public endpoints like `/feeds` and `/posts` can be abused for scraping or DDoS.

**Action:** Add Hono rate limiting middleware to public-facing routes.

#### 5.9 Add Zod validation to unvalidated API routes

**Files:** `apps/api/src/routes/subscriptions.ts`, `entries.ts`, `reads.ts`

**Issue:** These routes accept raw JSON bodies without Zod schema validation.

**Why:** Attackers can submit malformed or oversized payloads.

**Action:** Add `zValidator("json", schema)` middleware to all POST/DELETE handlers.

#### 5.10 Add Sentry to API server

**File:** `apps/api/src/index.ts`

**Issue:** Desktop/web and mobile have Sentry configured, but the API server has zero error tracking. Production errors only go to console.

**Why:** You won't know about production errors until users report them.

**Action:** Install `@sentry/node`, initialize in `index.ts`, wire into `app.onError()`.

#### 5.11 Add environment variable validation at startup

**File:** `apps/api/src/index.ts` (or new `src/env.ts`)

**Issue:** No validation that required env vars (`BETTER_AUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`) are set.

**Why:** App may start with missing config and fail in unexpected ways at runtime.

**Action:** Add startup validation that throws if required vars are missing.

#### 5.12 Reduce Sentry trace sampling on mobile

**File:** `apps/mobile/src/initialize/sentry.ts`

**Issue:** Mobile app captures 100% of Sentry traces.

**Why:** Excessive cost and performance overhead in production.

**Action:** Reduce `tracesSampleRate` to 0.1-0.2 (10-20%).

---

## 6. Risks / Launch Blockers Summary

| #    | Risk                                     | Severity     | Type         | Effort          |
| ---- | ---------------------------------------- | ------------ | ------------ | --------------- |
| 5.1  | Database credentials + GitHub PAT in git | **Critical** | Security     | 1-2 hours       |
| 5.2  | Wrong domains in Vercel config           | **High**     | Functional   | 30 min          |
| 5.3  | Cron path mismatch (feeds won't sync)    | **High**     | Functional   | 15 min          |
| 5.4  | 2FA TOTP bypass                          | **High**     | Security     | 2-4 hours       |
| 5.5  | No email service without env var         | **High**     | Functional   | 15 min (config) |
| 5.6  | No security headers on API               | **Medium**   | Security     | 15 min          |
| 5.7  | Cron auth falls open without secret      | **Medium**   | Security     | 15 min          |
| 5.8  | No API rate limiting on public routes    | **Medium**   | Availability | 1-2 hours       |
| 5.9  | Unvalidated JSON on some API routes      | **Medium**   | Security     | 1-2 hours       |
| 5.10 | No error tracking on API server          | **Medium**   | Ops          | 1 hour          |
| 5.11 | No env var validation at startup         | **Medium**   | Reliability  | 30 min          |
| 5.12 | 100% Sentry traces on mobile             | **Low**      | Cost/Perf    | 5 min           |

---

## 7. Optional Improvements After Launch

These are not required for go-live but improve the product over time:

| Item                                                               | Category       |
| ------------------------------------------------------------------ | -------------- |
| Full-text search API for posts/feeds                               | Feature        |
| Push notification sending from API                                 | Feature        |
| User blocking/reporting + content moderation                       | Feature        |
| Feed OPML export                                                   | Feature        |
| Complete mobile-web discover screen                                | Feature        |
| Implement mobile unread notification badge                         | Feature        |
| Settings sync rollback/retry on failure                            | Data integrity |
| Complete achievement system                                        | Feature        |
| Expand test coverage (currently 9 test files, zero frontend tests) | Quality        |
| Add Redis caching layer for API                                    | Performance    |
| API documentation (OpenAPI/Swagger)                                | DX             |
| i18n translation completeness audit                                | Quality        |
| Fix Safari CSS line-clamp bugs                                     | Compatibility  |
| Resolve 13 TODO/FIXME items across codebase                        | Tech debt      |
| Remove deprecated `Trial` enum from constants                      | Cleanup        |
| Review `dangerouslySetInnerHTML` usage for XSS sanitization        | Security       |
| Add circuit breaker for OG image generation                        | Reliability    |
| Docker non-root user for scraper container                         | Security       |
| Switch Turbo `envMode` from `"loose"` to `"strict"`                | Build safety   |
| Audit 12 patched npm dependencies for upstream fixes               | Maintenance    |

---

## 8. Recommended Timeline

### Day 1 (today)

- [ ] Rotate all exposed credentials (DB password, Supabase keys, GitHub PAT)
- [ ] Remove `.env` files from git tracking
- [ ] Fix Vercel domain references to `scflash.win`
- [ ] Fix cron path in `apps/api/vercel.json`
- [ ] Set `RESEND_API_KEY` in Vercel production env

### Days 2-3

- [ ] Add security headers middleware to API
- [ ] Make cron auth fail-closed in production
- [ ] Fix or disable 2FA TOTP verification
- [ ] Add Zod validation to unvalidated API routes
- [ ] Add env var validation at API startup
- [ ] Add Sentry to API server
- [ ] Reduce mobile Sentry trace rate

### Days 4-5

- [ ] Add rate limiting to public API routes
- [ ] Smoke test all critical user flows (auth, subscribe, read, comment)
- [ ] Verify email delivery (verification + password reset)
- [ ] Verify cron jobs fire correctly on Vercel
- [ ] Verify OG images generate for shares

### After launch

- [ ] Expand test coverage
- [ ] Implement search, push notifications, moderation
- [ ] Complete mobile-web features
- [ ] Address remaining TODO/FIXME items

---

## 9. Bottom Line

The core product (RSS reading, feed management, auth, content viewing) is **functionally complete**, inherited largely from the Follow upstream with Flash-specific API, auth, and scraping layers built on top.

**The project cannot safely go live today** due to committed database credentials and several configuration issues that would cause production failures (wrong domains, broken cron, missing email). However, all P0 blockers are fixable in a single focused day, and P1 items in a 2-3 day sprint.

**After addressing items 5.1-5.12, the product is launch-ready.**
