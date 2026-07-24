# Application & Technical Flows

> Phase 1 analysis. Diagrams describe the **desktop/web renderer** unless noted. File paths are relative to the repo root; renderer paths are shortened from `apps/desktop/layer/renderer/src/`.

## 1. Application startup flow

Entry: `main.tsx` provides the three JS contexts (`api`, `auth`, `queryClient`) **before** anything consumes them, then runs `initializeApp()` and renders the router. `App.tsx` gates rendering behind an `appIsReady` atom and shows a skeleton until then.

```mermaid
flowchart TD
  A["main.tsx"] --> B["authClientContext.provide(authClient)\nqueryClientContext.provide(queryClient)\napiContext.provide(followApi)"]
  B --> C["initializeApp()  — initialize/index.ts"]
  C --> C1["hydrateDatabaseToStore()  — @follow/store/hydrate\n(initializeDB + migrateDB, then hydrate all domain stores)"]
  C --> C2["initializeDayjs / registerHistoryStack"]
  C --> C3["hydrateSessionsFromLocalDb() (ai-chat)"]
  C --> C4["registerGlobalContext (electron bridge)"]
  C --> C5["doMigration()  — initialize/migrates"]
  C --> C6["subscribeNetworkStatus / initializeSettings"]
  C --> C7["initSentry / initI18n"]
  C --> C8["if whoami: settingSyncQueue.init()+syncLocal()"]
  C --> C9["initAnalytics + tracker.appInit()"]
  C --> D["registerWebPushNotifications (web only)"]
  C --> E["flushSync(setAppIsReady(true))"]
  E --> F["ReactDOM.createRoot(#root).render(RouterProvider)"]
  F --> G["App.tsx → RootProviders → AppLayer"]
  G --> H{"appIsReady?"}
  H -- no --> I["AppSkeleton"]
  H -- yes --> J["<Outlet /> — matched route renders"]
```

- **Files:** `main.tsx`, `initialize/index.ts`, `initialize/{settings,analytics,sentry,history,migrates,queue}.ts`, `App.tsx`, `providers/root-providers.tsx`.
- **Key functions:** `initializeApp`, `hydrateDatabaseToStore`, `setAppIsReady`, `applyAfterReadyCallbacks`.
- **Key state:** `appIsReady` atom (`atoms/app.ts`); domain stores hydrated from SQLite.
- **Contexts:** `apiContext`, `authClientContext`, `queryClientContext` (`@follow/store/context`) — a hand-rolled JS singleton context, **not** React context, so non-React store code can reach the API/query client.

## 2. Provider composition

```mermaid
flowchart TD
  RP["RootProviders (providers/root-providers.tsx)"] --> J["jotai Provider (jotaiStore)"]
  J --> M["MotionProvider (LazyMotion)"]
  M --> PQ["PersistQueryClientProvider (queryClient + persistConfig)"]
  PQ --> GF["GlobalFocusableProvider"]
  GF --> HK["HotkeyProvider"]
  HK --> I18N["I18nProvider"]
  I18N --> MS["ModalStackProvider"]
  MS --> U["UserProvider / ServerConfigsProvider"]
  MS --> S["StableRouterProvider / SettingSync / FollowCommandManager"]
  MS --> L["Suspense: Lazy* providers (ContextMenu, Popover, Lottie, ExternalJumpIn, PWA/Reload prompt)"]
  PQ --> IQ["InvalidateQueryProvider"]
```

- Server-cache persistence is wired here (`PersistQueryClientProvider`), which is why TanStack Query survives reloads.

## 3. Routing & navigation flow

File-based routing: `vite-plugin-route-builder` scans `pages/` and emits `generated-routes.ts`. `router.tsx` chooses `createHashRouter` (Electron / debug-proxy) or `createBrowserRouter` (web), optionally Sentry-wrapped.

```mermaid
flowchart TD
  P["pages/** (file-based)"] --> GR["generated-routes.ts (build-time)"]
  GR --> RT["router.tsx / router.web.tsx"]
  RT --> ROOT["'/' → App.tsx (Component), errorElement=ErrorElement"]
  ROOT --> M["(main)/layout.tsx — 3-column shell"]
  ROOT --> LOGIN["(login)/* — auth screens (Stage design)"]
  ROOT --> OB["onboarding/* — new-user-guide"]
  M --> LAYER["(main)/(layer)/*"]
  LAYER --> TL["timeline/[timelineId]/[feedId]/[entryId] — core reader"]
  LAYER --> SUB["(subview): discover / explore / rsshub / action / power"]
  LAYER --> AI["(ai)/ai — AI chat"]
  LAYER --> MOB["(mobile): notifications (mobile-web layout)"]
  ROOT --> SET["settings/* — nested settings tabs"]
  RT --> NF["'*' → NotFound"]
```

- **Timeline params:** `timelineId` (view/feed source) → `feedId` (subscription) → `entryId` (article). This nested triple is the app's primary navigation axis.
- **Key files:** `router.tsx`, `pages/(main)/layout.tsx`, `pages/(main)/(layer)/timeline/...`, `components/common/{ErrorElement,NotFound}.tsx`.

## 4. Core business flow — reading an entry (feed → list → reader)

```mermaid
sequenceDiagram
  participant U as User
  participant SC as subscription-column
  participant EC as entry-column
  participant ST as @follow/store
  participant Q as queries/* (TanStack)
  participant API as followApi (client-sdk)
  participant DB as SQLite (services)

  U->>SC: select feed/list (timelineId/feedId)
  SC->>ST: read subscription selectors/hooks
  EC->>Q: usePrefetch/entries query (feedId, view)
  Q->>API: GET entries
  API-->>Q: EntryListResponse (DTO)
  Q->>ST: entryActions.upsertMany(apiMorph → EntryModel)
  ST->>DB: persist (storeDbMorph → rows)
  ST-->>EC: entries via useEntry* selectors
  U->>EC: click entry (entryId)
  EC->>ST: entryActions read + markRead
  ST->>Q: invalidate/patch read status
  ST-->>EC: entry-content renders (reader pane)
```

- **Files:** `modules/subscription-column/*`, `modules/entry-column/*`, `modules/entry-content/*`, `queries/entries.ts`, `packages/internal/store/src/modules/entry/*`, `packages/internal/database/src/services/entry.ts`.
- **Key hooks:** `hooks/biz/useEntryActions.tsx` (555 LOC — read/star/share/AI actions), store `entry/hooks.ts`, `subscription/hooks.ts`.
- **Key state:** `entry` store (`data` map keyed by entryId), `subscription` store, `unread` store, `collection` store (stars).

## 5. State-update flow (the 3-layer morph model)

Every domain store follows the same shape: `store.ts` (Zustand state + actions), `getter.ts`/`selectors.ts` (pure reads), `hooks.ts` (React bindings + query prefetch), `types.ts`, `utils.ts`. Writes fan out to SQLite and to the server; reads come from the store.

```mermaid
flowchart LR
  subgraph Sources
    API["API DTO (client-sdk)"]
    ROW["SQLite row (Drizzle)"]
  end
  API -- morph/api.ts --> SM["Store Model (Zustand)"]
  ROW -- morph/db-store.ts --> SM
  SM -- morph/store-db.ts --> ROW2["SQLite row (persist)"]
  SM --> SEL["selectors / getters"]
  SEL --> HK["module hooks.ts"]
  HK --> UI["React components"]
  UI -- action --> ACT["store actions (createImmerSetter + createTransaction)"]
  ACT --> SM
  ACT --> ROW2
  ACT --> NET["optional: followApi write"]
```

- **Files:** `packages/internal/store/src/lib/helper.ts` (`createZustandStore`, `createImmerSetter`, `createTransaction`), `morph/{api,store-db,db-store}.ts`, each `modules/*/store.ts`.
- **Hydration:** on boot, `hydrate.ts` calls each store's `hydrate()` to load SQLite → store (via `db-store` morph).
- **Note:** stores import each other (e.g. `subscription/store.ts` imports `feed`, `inbox`, `list`, `unread`, `user`) — see coupling notes in `docs/refactor-risks.md`.

## 6. API request/response flow (client → server)

```mermaid
flowchart TD
  C["queries/* hook or store action"] --> API["followApi (@follow-app/client-sdk)"]
  API --> REQ["FollowClient (lib/api-client.ts)\nrequest interceptor: X-Client-Id, X-Session-Id,\ncreateDesktopAPIHeaders(version)"]
  REQ --> NET["fetch (credentials: include, no-store)"]
  NET --> SRV["Hono API (apps/api/src/index.ts)"]
  SRV --> CORS["cors() + optionalAuth middleware"]
  CORS --> RT["route (routes/*.ts) + zod-validator"]
  RT --> MW["requireAuth / requireAdmin as needed"]
  MW --> DBS["Drizzle → PostgreSQL"]
  DBS --> RESP["c.json(...)"]
  RESP --> RESI["response interceptor: setApiStatus(ONLINE)\n401 → setLoginModalShow"]
  RESI --> STORE["morph/api.ts → store upsert"]
```

- **Client:** `lib/api-client.ts` (interceptors for headers, network status, 401 → login modal). Network status lives in `atoms/network.ts`.
- **Server:** `apps/api/src/index.ts` mounts each router at both `/resource` and `/api/v1/resource`; auth handled at `/api/auth/*` (and legacy `/better-auth/*` rewrite).
- **Validation:** `@hono/zod-validator` per route.

## 7. Authentication & authorization flow

```mermaid
sequenceDiagram
  participant UI as Login UI (pages/(login))
  participant AC as authClient (lib/auth.ts)
  participant BA as Better Auth (/api/auth/*)
  participant DB as PostgreSQL (users/sessions/accounts)
  participant STR as @follow/store user
  participant APP as App providers

  UI->>AC: signIn (email/pw | GitHub | Google | 2FA)
  AC->>BA: POST /api/auth/*
  BA->>DB: validate / create session
  DB-->>BA: session cookie
  BA-->>AC: session
  AC->>STR: userActions set whoami
  Note over APP: UserProvider observes session,\nhandleSessionChanges → settingSyncQueue.init()+sync
  APP->>APP: authorized routes/features unlock
  Note over UI,APP: 401 anywhere → api-client interceptor → setLoginModalShow(true)
```

- **Server:** `apps/api/src/auth/index.ts` (Better Auth: emailAndPassword, GitHub, Google, `twoFactor`, `anonymous`, `admin`, Stripe plugin, custom plugins in `auth/plugins.ts`). Email via Resend (`lib/email.ts`).
- **Authorization:** `middleware/auth.ts` — `optionalAuth` (global), `requireAuth`, `requireAdmin`.
- **Client:** `providers/user-provider.tsx`, `atoms/user.ts` (`setLoginModalShow`), `@follow/store` user module (`whoami`), `settingSyncQueue` (post-login settings sync).

## 8. Error handling, analytics, config

```mermaid
flowchart LR
  ERR["Route errorElement (ErrorElement.tsx)"] --> SENTRY["Sentry (initialize/sentry.ts)"]
  APIERR["api-client errorInterceptor"] --> NETATOM["atoms/network.ts (ONLINE/OFFLINE)"]
  API401["401 interceptor"] --> LOGIN["setLoginModalShow"]
  TRACK["@follow/tracker events"] --> ANALYTICS["initialize/analytics.ts"]
  CFG["ServerConfigsProvider"] --> SATOM["atoms/server-configs.ts (feature flags / remote config)"]
  SETTINGS["initialize/settings.ts + settingSyncQueue"] --> SETATOM["atoms/settings/*"]
```

- **Errors:** React Router `errorElement` (`ErrorElement.tsx`) + Sentry wrapping the router; API failures surface through interceptors and network atoms.
- **Analytics/telemetry:** `@follow/tracker` (`tracker.appInit`, `tracker.uiRenderInit`, etc.), initialized in `initialize/analytics.ts`.
- **Feature flags / remote config:** `ServerConfigsProvider` + `atoms/server-configs.ts` (server-driven); `atoms/debug-feature.ts` for local toggles.
- **Settings:** `initialize/settings.ts`, `atoms/settings/*`, synced to server via `modules/settings/helper/sync-queue` when authenticated.
