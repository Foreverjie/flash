# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Folo (fork of [RSSNext/Folo](https://github.com/RSSNext/Folo)) — an RSS/content aggregation platform. Monorepo managed by **pnpm workspaces + Turborepo**.

### Apps

- `apps/desktop` — Electron + Vite + React 19 (renderer is also the primary web app)
- `apps/mobile` — React Native via Expo 53
- `apps/ssr` — Fastify + React 19 SSR for sharing/OG pages
- `apps/api` — Hono.js API server, deployed on Vercel with Supabase PostgreSQL

### Shared packages

All under `packages/internal/`: `components`, `atoms`, `hooks`, `store`, `utils`, `database`, `models`, `shared`, `types`, `constants`, `tracker`, `logger`.

## Commands

```bash
pnpm install                          # Install all deps

# Development
cd apps/desktop && pnpm run dev:web   # Desktop renderer in browser (recommended)
cd apps/desktop && pnpm run dev:electron  # Full Electron
cd apps/mobile && pnpm run dev        # Expo dev server
cd apps/mobile && pnpm run ios        # iOS simulator
cd apps/api && pnpm run dev           # API with hot reload
cd apps/ssr && pnpm run dev           # SSR dev server

# Quality gates (run in this order from root)
pnpm run typecheck                    # 1. Type checking
pnpm run lint:fix                     # 2. Lint + auto-fix
pnpm run test                         # 3. Tests (Vitest)

# Build
pnpm run build:web                    # Build web version
```

## Architecture

### State management

- **Jotai** for atomic state, **Zustand** for complex stores, **TanStack Query v5** for server state

### Database

- **Server** (API): Drizzle ORM + Supabase PostgreSQL. Schema in `apps/api/src/db/schema.ts`, migrations in `apps/api/drizzle/`
- **Client** (Desktop/Mobile): Drizzle + SQLite (`wa-sqlite` on desktop, `expo-sqlite` on mobile). Platform-specific impls: `db.desktop.ts`, `db.rn.ts` in `packages/internal/database/`

### Auth

- **Better Auth** with Drizzle adapter, mounted at `/api/auth/*`. Supports email/password, GitHub OAuth, Google OAuth, 2FA

### API routing (Hono)

- Route files in `apps/api/src/routes/` export Hono instances, mounted in `src/index.ts` with dual paths (`/resource` and `/api/v1/resource`)
- Middleware: `requireAuth` (blocks unauthenticated), `optionalAuth` (populates user if present)
- Validation: `@hono/zod-validator` with Zod schemas

### Desktop renderer routing

- File-based routing via `vite-plugin-route-builder`, generates `generated-routes.ts`
- Hash router in Electron, browser router on web
- Feature modules in `apps/desktop/layer/renderer/src/modules/`

### i18n

- `i18next` + `react-i18next`. Flat keys only, no `defaultValue`. Locales in `/locales/` — must provide `en`, `zh-CN`, `ja`

## Code Conventions

- **TypeScript strict**, no `any` — use precise types
- **Imports**: use `pathe` instead of `node:path`
- **Comments** in English
- Reusable UI → `packages/internal/components`; app-specific UI stays in its app

### UI system — Desktop/Web

- Tailwind CSS with **Apple UIKit color tokens** (light/dark adaptive): `text-red`, `bg-blue`, `bg-fill`, `text-text-secondary`, `bg-material-thick`, `bg-menu`, etc.
- Icons: MingCute with `i-mgc-` prefix (e.g., `i-mgc-copy-cute-re`)
- Motion: prefer CSS transitions; use Framer Motion `m.*` (from `motion/react` with LazyMotion) only when needed. Spring presets from `@follow/components/constants/spring.js`

### UI system — Mobile

- **NativewindCSS** for styling (no `StyleSheet.create` for new UI)
- Colors: React Native UIKit color system via `react-native-uikit-colors` (`system-background`, `label`, `system-fill`, etc.)
- Icons: `@/apps/mobile/icons` only

### Testing

- **Vitest** — co-locate test files near source (`*.test.ts`)
- API tests use MSW for request mocking
- Run single test: `pnpm vitest run path/to/file.test.ts`

### Pre-commit hooks

- `simple-git-hooks` + `lint-staged`: runs ESLint fix + Prettier on staged files

## Subproject Guides

Each app has its own `AGENTS.md` with app-specific conventions. The closest guide to the edited file takes precedence when rules conflict:

- `apps/api/AGENTS.md` — Hono patterns, middleware, route structure
- `apps/desktop/AGENTS.md` — UIKit colors, motion, glassmorphic design
- `apps/mobile/AGENTS.md` — RN UIKit colors, NativewindCSS
- `packages/internal/AGENTS.md` — shared package conventions
