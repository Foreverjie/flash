# Database Integration

The API now uses PostgreSQL via the `@follow/database` workspace package.

## Setup

### Environment Variables

Create a `.env` file in `apps/api/` based on `.env.example`:

```bash
# PostgreSQL Connection
POSTGRES_URL="postgres://postgres.your-tenant-id:password@host:5432/postgres"

# Supabase Configuration (Alternative)
SUPABASE_URL=
SUPABASE_ANON_KEY="your-anon-key-here"
```

### Database Initialization

The database is automatically initialized when the server starts. The initialization sequence is:

1. Connect to PostgreSQL using the connection string from `POSTGRES_URL`
2. Run pending migrations automatically
3. Start the API server

See `src/index.ts` for the startup logic.

## Database Access

### Direct Query Access

Import the `db` instance to run queries:

```typescript
import { db } from "../db.js"
import { eq } from "drizzle-orm"
import { feedsTable } from "@follow/database/schemas/index"

// Find a feed
const feed = await db.query.feedsTable.findFirst({
  where: eq(feedsTable.id, feedId),
})

// Insert a feed
const [newFeed] = await db.insert(feedsTable).values(feedData).returning()

// Update a feed
await db.update(feedsTable).set({ title: "New Title" }).where(eq(feedsTable.id, feedId))

// Delete a feed
await db.delete(feedsTable).where(eq(feedsTable.id, feedId))
```

### Available Tables

All tables from the database package are available:

- `feedsTable` - RSS feeds
- `entriesTable` - Feed entries/articles
- `subscriptionsTable` - User subscriptions
- `usersTable` - User profiles
- `collectionsTable` - Bookmarked entries
- `listsTable` - Custom feed lists
- `inboxesTable` - Inbox configurations
- `unreadTable` - Unread counts
- `summariesTable` - AI summaries
- `translationsTable` - Translated content
- `imagesTable` - Image metadata
- `aiChatTable` - AI chat sessions
- `aiChatMessagesTable` - AI chat messages

## Migration from Mock Data

The following routes have been migrated from mock data to PostgreSQL:

### Feeds (`routes/feeds.ts`)

- `GET /feeds` - List feeds with pagination
- `GET /feeds/:id` - Get feed by ID
- `POST /feeds` - Create new feed
- `PATCH /feeds/:id` - Update feed
- `DELETE /feeds/:id` - Delete feed

### Entries (`routes/entries.ts`)

- `GET /entries` - List entries with filtering
- `GET /entries/:id` - Get entry by ID
- `PATCH /entries/:id` - Update entry
- `POST /entries/:id/read` - Mark as read
- `POST /entries/:id/unread` - Mark as unread

## Development

### Running Locally

```bash
# Make sure PostgreSQL is running and connection string is set
cd apps/api
pnpm dev
```

### Testing

```bash
# Run tests
cd apps/api
pnpm test

# Type checking
pnpm typecheck
```

## Database Schema

The database schema is defined in `packages/internal/database/src/schemas/index.ts`.

Key features:

- PostgreSQL-specific types (jsonb, timestamp, etc.)
- Proper foreign key relationships
- Indexes for performance
- Migration system via Drizzle Kit

### Running Migrations

Migrations are automatically run on server startup. To manually generate new migrations:

```bash
cd packages/internal/database
pnpm run generate
```

## Troubleshooting

### Connection Errors

If you see connection errors:

1. Verify `POSTGRES_URL` is correct in `.env`
2. Ensure PostgreSQL server is running and accessible
3. Check firewall/network settings
4. Verify database credentials

### Migration Errors

If migrations fail:

1. Check migration files in `packages/internal/database/src/drizzle/`
2. Ensure database schema is in sync
3. Review error logs for specific SQL errors

### Type Errors

If you see TypeScript errors:

1. Run `pnpm typecheck` to see all errors
2. Ensure imports use correct paths (e.g., `@follow/database/schemas/index`)
3. Check that all required dependencies are installed

## Architecture

```
apps/api/
├── src/
│   ├── db.ts              # Database initialization
│   ├── index.ts           # Server startup (calls setupDatabase())
│   └── routes/
│       ├── feeds.ts       # Uses feedsTable
│       └── entries.ts     # Uses entriesTable
└── .env                   # Database credentials

packages/internal/database/
├── src/
│   ├── db.desktop.ts      # PostgreSQL connection for Node.js
│   ├── schemas/           # Table definitions
│   ├── services/          # Data access layer
│   └── drizzle/           # Migrations
└── drizzle.config.ts      # Drizzle configuration
```

## Next Steps

1. **Add more routes**: Implement remaining API endpoints (subscriptions, lists, etc.)
2. **Add tests**: Create integration tests for database operations
3. **Optimize queries**: Add indexes and optimize query patterns
4. **Add transactions**: Wrap related operations in transactions
5. **Connection pooling**: Configure connection pool settings for production
