# Follow API - Quick Reference

## 🚀 Start Server

```bash
cd apps/api
pnpm dev          # Development with hot reload
pnpm start        # Production (requires build first)
```

## 📍 Base URL

```
http://localhost:3001
```

## 🔗 Quick Endpoint Reference

| Method      | Endpoint                   | Description         |
| ----------- | -------------------------- | ------------------- |
| **Health**  |                            |                     |
| GET         | `/health`                  | Health check        |
| **Auth**    |                            |                     |
| GET         | `/auth/session`            | Get current session |
| POST        | `/auth/sign-in`            | Sign in             |
| POST        | `/auth/sign-out`           | Sign out            |
| **Feeds**   |                            |                     |
| GET         | `/feeds`                   | List feeds          |
| GET         | `/feeds/:id`               | Get feed            |
| POST        | `/feeds`                   | Create feed         |
| PATCH       | `/feeds/:id`               | Update feed         |
| DELETE      | `/feeds/:id`               | Delete feed         |
| **Entries** |                            |                     |
| GET         | `/entries`                 | List entries        |
| GET         | `/entries/:id`             | Get entry           |
| PATCH       | `/entries/:id`             | Update entry        |
| POST        | `/entries/:id/read`        | Mark as read        |
| POST        | `/entries/:id/unread`      | Mark as unread      |
| POST        | `/entries/:id/star`        | Star entry          |
| POST        | `/entries/:id/unstar`      | Unstar entry        |
| **Lists**   |                            |                     |
| GET         | `/lists`                   | List all lists      |
| GET         | `/lists/:id`               | Get list            |
| POST        | `/lists`                   | Create list         |
| PATCH       | `/lists/:id`               | Update list         |
| DELETE      | `/lists/:id`               | Delete list         |
| GET         | `/lists/:id/feeds`         | Get feeds in list   |
| POST        | `/lists/:id/feeds`         | Add feed to list    |
| DELETE      | `/lists/:id/feeds/:feedId` | Remove feed         |
| **AI**      |                            |                     |
| POST        | `/ai/summary`              | Generate summary    |
| POST        | `/ai/translation`          | Translate content   |
| POST        | `/ai/chat`                 | AI chat (streaming) |
| POST        | `/ai/summary-title`        | Generate title      |
| POST        | `/ai/daily`                | Daily digest        |
| GET         | `/ai/config`               | Get AI config       |

## 📦 Response Format

### Success

```json
{
  "code": 0,
  "data": { ... }
}
```

### Error

```json
{
  "code": 404,
  "message": "Resource not found"
}
```

## 🧪 Testing Examples

### cURL

```bash
# Health check
curl http://localhost:3001/health

# Get session
curl http://localhost:3001/auth/session

# List feeds
curl http://localhost:3001/feeds

# Get feed by ID
curl http://localhost:3001/feeds/feed-1

# Create feed
curl -X POST http://localhost:3001/feeds \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/feed.xml"}'

# List entries with filters
curl "http://localhost:3001/entries?feedId=feed-1&read=false&limit=10"

# Mark entry as read
curl -X POST http://localhost:3001/entries/entry-1/read

# AI summary
curl -X POST http://localhost:3001/ai/summary \
  -H "Content-Type: application/json" \
  -d '{"id":"entry-1","language":"en"}'
```

### JavaScript/Fetch

```javascript
// Get feeds
const feeds = await fetch("http://localhost:3001/feeds").then((r) => r.json())

// Create list
const list = await fetch("http://localhost:3001/lists", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "My List",
    description: "A curated list",
  }),
}).then((r) => r.json())

// AI chat (streaming)
const response = await fetch("http://localhost:3001/ai/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Hello" }],
  }),
})
const reader = response.body.getReader()
// Read stream...
```

## 📁 File Structure

```
src/
├── index.ts              # Main app
├── middleware/
│   └── auth.ts           # Auth middleware
├── routes/
│   ├── ai.ts             # AI endpoints
│   ├── auth.ts           # Auth endpoints
│   ├── entries.ts        # Entry endpoints
│   ├── feeds.ts          # Feed endpoints
│   ├── health.ts         # Health check
│   └── lists.ts          # List endpoints
├── types/
│   └── common.ts         # Shared types
└── utils/
    └── response.ts       # Response helpers
```

## 🛠️ Development Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm typecheck    # Type checking
pnpm lint         # Lint code
pnpm lint:fix     # Auto-fix linting
pnpm test         # Run tests
```

## 📖 More Documentation

- **API.md** - Complete API documentation
- **IMPLEMENTATION.md** - Implementation details
- **AGENTS.md** - Development guide
- **README.md** - Getting started

## ⚠️ Current Limitations

- All data is **mock/in-memory** (no database)
- No real **authentication** (placeholder)
- No **input validation** (Zod pending)
- No **rate limiting**
- No **real AI** integration

Ready for database layer implementation!
