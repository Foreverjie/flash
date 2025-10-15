# Follow API Documentation

Complete API implementation based on the Follow Client SDK.

## Base URL

```
http://localhost:3001
```

## Response Format

All API responses follow this structure:

```typescript
{
  "code": 0,        // 0 for success, non-zero for errors
  "data": {...},    // Response data
  "message": "..."  // Optional error message
}
```

---

## Endpoints

### Health Check

#### `GET /health`

Check API health status.

**Response:**

```json
{
  "code": 0,
  "data": {
    "status": "ok",
    "timestamp": "2025-10-15T12:00:00.000Z"
  }
}
```

---

### Authentication

#### `GET /auth/session`

Get current user session.

**Response:**

```json
{
  "code": 0,
  "data": {
    "session": {
      "id": "session-id",
      "userId": "user-id",
      "expiresAt": "2025-11-15T12:00:00.000Z",
      "createdAt": "2025-10-15T12:00:00.000Z",
      "updatedAt": "2025-10-15T12:00:00.000Z"
    },
    "user": {
      "id": "user-id",
      "name": "Demo User",
      "email": "demo@follow.is",
      "handle": "demo",
      "image": null,
      "createdAt": "2025-10-15T12:00:00.000Z"
    },
    "role": "user"
  }
}
```

#### `POST /auth/sign-in`

Sign in to the platform.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

#### `POST /auth/sign-out`

Sign out of the platform.

**Response:**

```json
{
  "code": 0
}
```

---

### Feeds

#### `GET /feeds`

List all feeds with pagination.

**Query Parameters:**

- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**

```json
{
  "code": 0,
  "data": {
    "data": [...],
    "total": 100,
    "page": 1,
    "limit": 20,
    "hasMore": true
  }
}
```

#### `GET /feeds/:id`

Get a specific feed by ID.

**Response:**

```json
{
  "code": 0,
  "data": {
    "id": "feed-1",
    "url": "https://example.com/feed.xml",
    "title": "Example Feed",
    "description": "An example RSS feed",
    "siteUrl": "https://example.com",
    "image": null,
    "checkedAt": "2025-10-15T12:00:00.000Z"
  }
}
```

#### `POST /feeds`

Create or discover a new feed.

**Request Body:**

```json
{
  "url": "https://example.com/feed.xml"
}
```

#### `PATCH /feeds/:id`

Update a feed.

**Request Body:**

```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

#### `DELETE /feeds/:id`

Delete a feed.

---

### Entries

#### `GET /entries`

List entries with filtering and pagination.

**Query Parameters:**

- `page` (number): Page number
- `limit` (number): Items per page
- `feedId` (string): Filter by feed ID
- `read` (boolean): Filter by read status
- `starred` (boolean): Filter by starred status

**Response:**

```json
{
  "code": 0,
  "data": {
    "data": [
      {
        "id": "entry-1",
        "feedId": "feed-1",
        "title": "Example Entry",
        "url": "https://example.com/article",
        "content": "<p>Content</p>",
        "author": "John Doe",
        "publishedAt": "2025-10-15T12:00:00.000Z",
        "read": false,
        "starred": false
      }
    ],
    "total": 50,
    "hasMore": true
  }
}
```

#### `GET /entries/:id`

Get a specific entry.

#### `PATCH /entries/:id`

Update entry (mark as read, starred, etc.).

**Request Body:**

```json
{
  "read": true,
  "starred": false
}
```

#### `POST /entries/:id/read`

Mark entry as read.

#### `POST /entries/:id/unread`

Mark entry as unread.

#### `POST /entries/:id/star`

Star an entry.

#### `POST /entries/:id/unstar`

Unstar an entry.

---

### Lists

#### `GET /lists`

List all user lists.

**Response:**

```json
{
  "code": 0,
  "data": [
    {
      "id": "list-1",
      "title": "My Reading List",
      "description": "A curated list",
      "view": 0,
      "fee": 0,
      "ownerUserId": "user-id",
      "createdAt": "2025-10-15T12:00:00.000Z"
    }
  ]
}
```

#### `GET /lists/:id`

Get a specific list.

#### `POST /lists`

Create a new list.

**Request Body:**

```json
{
  "title": "New List",
  "description": "Description",
  "view": 0,
  "fee": 0
}
```

#### `PATCH /lists/:id`

Update a list.

#### `DELETE /lists/:id`

Delete a list.

#### `GET /lists/:id/feeds`

Get feeds in a list.

#### `POST /lists/:id/feeds`

Add a feed to a list.

**Request Body:**

```json
{
  "feedId": "feed-1",
  "view": 0,
  "category": "tech",
  "isPrivate": false
}
```

#### `DELETE /lists/:id/feeds/:feedId`

Remove a feed from a list.

---

### AI Features

#### `POST /ai/summary`

Generate AI summary for an entry.

**Request Body:**

```json
{
  "id": "entry-1",
  "language": "en",
  "target": "content"
}
```

**Response:**

```json
{
  "code": 0,
  "data": "AI-generated summary..."
}
```

#### `POST /ai/translation`

Translate entry fields.

**Request Body:**

```json
{
  "id": "entry-1",
  "language": "zh-CN",
  "fields": "title,content"
}
```

**Response:**

```json
{
  "code": 0,
  "data": {
    "title": "翻译的标题",
    "content": "翻译的内容"
  }
}
```

#### `POST /ai/chat`

AI chat with streaming response.

**Request Body:**

```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "model": "openai/gpt-4o-mini",
  "context": {
    "mainEntryId": "entry-1"
  }
}
```

**Response:** Streaming text response

#### `POST /ai/summary-title`

Generate title for AI chat.

**Request Body:**

```json
{
  "messages": [{ "role": "user", "content": "..." }]
}
```

#### `POST /ai/daily`

Generate daily digest.

**Request Body:**

```json
{
  "startDate": "2025-10-15",
  "view": "0"
}
```

#### `GET /ai/config`

Get AI configuration and usage limits.

**Response:**

```json
{
  "code": 0,
  "data": {
    "defaultModel": "openai/gpt-4o-mini",
    "availableModels": ["openai/gpt-4o-mini", "openai/gpt-4o"],
    "rateLimit": {
      "maxTokens": 100000,
      "remainingTokens": 95000
    },
    "usage": {
      "total": 100000,
      "used": 5000,
      "remaining": 95000
    }
  }
}
```

---

## Error Responses

Error responses include a non-zero `code` and descriptive `message`:

```json
{
  "code": 404,
  "message": "Resource not found"
}
```

Common error codes:

- `400` - Bad request / Validation error
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not found
- `500` - Internal server error

---

## Development Notes

- **Mock Data**: All endpoints currently return mock data
- **No Database**: Database integration pending
- **No Auth**: Authentication middleware is a placeholder
- **Streaming**: AI chat endpoint supports streaming responses

---

## Next Steps

1. Integrate real database (Drizzle ORM)
2. Implement proper authentication (Better Auth)
3. Add input validation (Zod)
4. Implement rate limiting
5. Add comprehensive test coverage
6. Set up production deployment
