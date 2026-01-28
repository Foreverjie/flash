# Apps API - Agent Guide

This guide provides agent-specific instructions for working with the Follow API module.

## Overview

The `apps/api` module is a Hono.js-based API server with Better-auth authentication, Drizzle ORM, and RSS adapter system. Designed for deployment on Vercel with PostgreSQL (Supabase).

## Technology Stack

- **Framework**: Hono.js v4.7+ (fast, edge-ready web framework)
- **Runtime**: Node.js with `@hono/node-server` (local) or Vercel (production)
- **Database**: Supabase PostgreSQL via Drizzle ORM
- **Auth**: Better-auth with Drizzle adapter
- **Validation**: Zod + @hono/zod-validator
- **Build Tool**: tsup (TypeScript bundler)
- **Dev Server**: tsx with watch mode for hot reload

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts            # Entry point with Vercel adapter
│   ├── auth/               # Better-auth configuration
│   │   ├── index.ts        # Auth setup with Drizzle adapter
│   │   └── client.ts       # Auth client for programmatic use
│   ├── db/                 # Database layer
│   │   ├── client.ts       # PostgreSQL/Drizzle client
│   │   ├── schema.ts       # All table definitions
│   │   └── index.ts        # Exports
│   ├── lib/
│   │   └── rss/            # RSS adapter system
│   │       ├── types.ts    # RSS types
│   │       ├── base-adapter.ts
│   │       ├── default-adapter.ts
│   │       ├── github-adapter.ts
│   │       └── index.ts    # RSSManager
│   ├── middleware/
│   │   └── auth.ts         # Auth middleware (requireAuth, optionalAuth)
│   ├── routes/             # API routes
│   │   ├── auth.ts
│   │   ├── feeds.ts
│   │   ├── users.ts
│   │   └── comments.ts
│   └── utils/              # Utilities
│       ├── logger.ts
│       └── response.ts
├── drizzle/                # Database migrations
├── drizzle.config.ts       # Drizzle Kit configuration
├── vercel.json             # Vercel deployment config
└── package.json
```

## Code Conventions

### File Structure

- `src/index.ts` - Main application entry, server setup, and middleware
- `src/routes/` - Route handlers with zod validation
- `src/db/schema.ts` - All Drizzle table definitions
- `src/auth/` - Better-auth configuration

### TypeScript

- Strict mode enabled
- No `any` types allowed
- Use Hono's type helpers for request/response typing
- All code comments in English

### Routing Patterns

```typescript
// Route file with zod validation
import { zValidator } from "@hono/zod-validator"
import { Hono } from "hono"
import { z } from "zod"

import { requireAuth } from "../middleware/auth.js"

const router = new Hono()

const createSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
})

router.post("/", requireAuth, zValidator("json", createSchema), async (c) => {
  const user = c.get("user")
  const data = c.req.valid("json")
  // ...
})

export default router
```

### Middleware

- Use Hono's built-in middleware when possible (`cors`, `logger`, `jwt`, etc.)
- Add custom middleware in a dedicated `src/middleware/` folder
- Apply global middleware using `app.use('*', middleware())`

### Error Handling

- Use Hono's error handling: `c.json({ error: 'Message' }, 400)`
- For custom error handlers, use `app.onError()`
- Log errors using `console.error()`

### Environment Variables

- Access via `process.env.VARIABLE_NAME`
- Use `.env` file for local development (add to `.gitignore`)
- Document required env vars in README.md

## Development Workflow

1. **Add a new route:**
   - Create file in `src/routes/`
   - Export Hono instance with route handlers
   - Import and mount in `src/index.ts` using `app.route()`

2. **Add middleware:**
   - For simple middleware, add inline in route file
   - For reusable middleware, create in `src/middleware/`
   - Apply globally in `src/index.ts` or per-route

3. **Testing:**
   - Use Vitest for unit tests
   - Place test files next to source: `*.test.ts`
   - Use Hono's test utilities: `import { testClient } from 'hono/testing'`

## Commands

```bash
# Development with hot reload
pnpm run dev

# Type checking
pnpm run typecheck

# Linting
pnpm run lint
pnpm run lint:fix

# Build for production
pnpm run build

# Start production server
pnpm run start

# Run tests
pnpm run test
```

## Quality Gates

Before committing:

1. `pnpm run typecheck` - Must pass without errors
2. `pnpm run lint:fix` - Auto-fix linting issues
3. `pnpm run test` - All tests must pass

## API Design Guidelines

- Use RESTful conventions where appropriate
- Return JSON responses with consistent structure
- Use proper HTTP status codes
- Include timestamps in responses when relevant
- Add pagination for list endpoints
- Version API routes if breaking changes are expected (`/v1/`, `/v2/`)

## Performance Considerations

- Hono is edge-optimized; keep handlers lightweight
- Use streaming for large responses
- Implement rate limiting for public endpoints
- Consider caching strategies for frequently accessed data

## Integration with Monorepo

- This module is part of the pnpm workspace
- Can import shared utilities from `packages/internal/*`
- Follow monorepo conventions from root `AGENTS.md`
- Run quality gates from the root or package level
