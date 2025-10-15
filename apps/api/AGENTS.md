# Apps API - Agent Guide

This guide provides agent-specific instructions for working with the Follow API module.

## Overview

The `apps/api` module is a lightweight Hono.js-based API server that provides backend services for the Follow application.

## Technology Stack

- **Framework**: Hono.js v4.7+ (fast, edge-ready web framework)
- **Runtime**: Node.js with `@hono/node-server`
- **Build Tool**: tsup (TypeScript bundler)
- **Dev Server**: tsx with watch mode for hot reload

## Code Conventions

### File Structure

- `src/index.ts` - Main application entry, server setup, and middleware
- `src/routes/` - Route handlers, one file per route group
- Each route file exports a Hono instance configured with related endpoints

### TypeScript

- Strict mode enabled
- No `any` types allowed
- Use Hono's type helpers for request/response typing
- All code comments in English

### Routing Patterns

```typescript
// Route file: src/routes/example.ts
import { Hono } from "hono"

const example = new Hono()

example.get("/", (c) => {
  return c.json({ message: "Example" })
})

export default example
```

```typescript
// Main file: src/index.ts
import exampleRouter from "./routes/example"

app.route("/example", exampleRouter)
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
