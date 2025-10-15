# Follow API

[![API CI](https://github.com/Foreverjie/flash/workflows/API%20CI/badge.svg)](https://github.com/Foreverjie/flash/actions/workflows/api-ci.yml)

Hono.js-based API server for the Follow application.

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
cd apps/api
pnpm dev

# Server runs on http://localhost:3001
```

## Development

```bash
# Development with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Type checking
pnpm typecheck

# Linting
pnpm lint
pnpm lint:fix

# Run tests
pnpm test
```

## Quality Gates

Before committing, ensure all checks pass:

```bash
# Run all quality checks
pnpm typecheck && pnpm lint && pnpm test
```

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts              # Main application entry point
│   ├── middleware/
│   │   └── auth.ts           # Authentication middleware
│   ├── routes/               # API route handlers
│   │   ├── ai.ts             # AI features
│   │   ├── auth.ts           # Authentication
│   │   ├── entries.ts        # Entry management
│   │   ├── feeds.ts          # Feed management
│   │   ├── health.ts         # Health check
│   │   └── lists.ts          # List management
│   ├── types/
│   │   └── common.ts         # Shared type definitions
│   └── utils/
│       └── response.ts       # Response helpers
├── API.md                    # Complete API documentation
├── CI.md                     # CI/CD documentation
├── QUICK_REFERENCE.md        # Quick lookup guide
├── package.json
├── tsconfig.json
└── tsup.config.ts            # Build configuration
```

## API Endpoints

### Core

- `GET /` - API info and available endpoints
- `GET /health` - Health check

### Authentication

- `GET /auth/session` - Get current session
- `POST /auth/sign-in` - Sign in
- `POST /auth/sign-out` - Sign out

### Feeds

- `GET /feeds` - List feeds
- `GET /feeds/:id` - Get feed
- `POST /feeds` - Create feed
- `PATCH /feeds/:id` - Update feed
- `DELETE /feeds/:id` - Delete feed

### Entries

- `GET /entries` - List entries (with filters)
- `GET /entries/:id` - Get entry
- `PATCH /entries/:id` - Update entry
- `POST /entries/:id/read|unread|star|unstar` - Entry actions

### Lists

- `GET /lists` - List all lists
- `GET /lists/:id` - Get list
- `POST /lists` - Create list
- `PATCH /lists/:id` - Update list
- `DELETE /lists/:id` - Delete list
- `GET /lists/:id/feeds` - Get feeds in list
- `POST /lists/:id/feeds` - Add feed to list
- `DELETE /lists/:id/feeds/:feedId` - Remove feed

### AI Features

- `POST /ai/summary` - Generate summary
- `POST /ai/translation` - Translate content
- `POST /ai/chat` - AI chat (streaming)
- `POST /ai/summary-title` - Generate title
- `POST /ai/daily` - Daily digest
- `GET /ai/config` - AI configuration

## Technology Stack

- **Hono.js** - Fast, lightweight web framework
- **TypeScript** - Type-safe development
- **tsup** - TypeScript bundler
- **tsx** - TypeScript execution with hot reload
- **Vitest** - Testing framework

## Documentation

- **[API.md](./API.md)** - Complete API documentation with examples
- **[CI.md](./CI.md)** - CI/CD pipeline documentation
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Quick lookup guide
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Implementation details
- **[AGENTS.md](./AGENTS.md)** - AI agent development guide

## CI/CD

The API module uses GitHub Actions for continuous integration:

- ✅ **Type checking** - Ensures TypeScript correctness
- ✅ **Linting** - Enforces code style
- ✅ **Testing** - Runs test suite
- ✅ **Building** - Creates production bundle

See [CI.md](./CI.md) for detailed CI/CD documentation.
