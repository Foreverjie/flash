# Scrapling Data Source Module — Design Spec

**Date:** 2026-03-12
**Status:** Approved
**MVP Scope:** X (Twitter) user timeline scraping via a Python Scrapling microservice

---

## Overview

Extend Folo's data ingestion beyond RSS by adding a Python-based scraping microservice (using [Scrapling](https://github.com/D4Vinci/Scrapling)) that can fetch content from sources without native RSS feeds. The MVP targets X (Twitter) user timelines. The microservice integrates with the existing Node.js Hono API via two internal HTTP endpoints, requiring no changes to the existing DB schema, subscription model, or client apps.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Node.js API (Vercel)                   │
│                                                          │
│  POST /feeds/:id/refresh                                 │
│    → if adapterType = "x_timeline":                      │
│      → call Python POST /scrape { feedId, handle }       │
│                                                          │
│  GET  /internal/scrapling/feeds   ← Python polls this    │
│  POST /internal/scrapling/ingest  ← Python pushes here   │
└──────────────────────────────────────────────────────────┘
                        ▲  HTTP (INTERNAL_API_KEY header)
                        │
┌─────────────────────────────────────────────────────────┐
│         Python Scrapling Service (Railway/Fly.io)        │
│                                                          │
│  POST /scrape  ← on-demand, triggered by Node.js        │
│  GET  /health  ← liveness check                         │
│                                                          │
│  APScheduler: every 15 min                              │
│    1. GET /internal/scrapling/feeds (subscribed only)    │
│    2. Scrape each X account via Scrapling + Camoufox     │
│    3. POST /internal/scrapling/ingest with new posts     │
└─────────────────────────────────────────────────────────┘
```

### Two modes of operation

**On-demand (user-triggered):**

1. User clicks refresh on an x_timeline feed in the UI
2. `POST /feeds/:id/refresh` detects `adapterType === "x_timeline"`
3. Calls Python `POST /scrape { feedId, handle }`
4. Python scrapes only that one account, pushes results to ingest endpoint
5. Returns 200 to user once done (30s timeout, 504 on timeout)

**Background (scheduled):**

1. APScheduler fires every 15 minutes
2. Fetches only feeds with `subscriptionCount > 0` from Node.js
3. Scrapes each account, pushes new posts immediately as found
4. Skips feeds with no active subscribers

---

## Components

### 1. Python Scrapling Service

**Location:** `apps/scraper/` (new top-level app)

```
apps/scraper/
├── main.py           # FastAPI app, mounts /scrape and /health
├── scheduler.py      # APScheduler background loop
├── scrapers/
│   ├── base.py       # BaseScraper abstract class
│   └── x_timeline.py # XTimelineScraper (Scrapling + Camoufox)
├── models.py         # Pydantic: ScrapedPost, FeedConfig
├── client.py         # HTTP client → Node.js API
└── config.py         # env: NODE_API_URL, INTERNAL_API_KEY
```

**Endpoints:**

- `POST /scrape` — body: `{ feedId: str, handle: str }` → scrapes account → pushes to Node.js ingest → returns `{ inserted: int }`
- `GET /health` — returns `{ ok: true }`

**XTimelineScraper strategy:**

- Opens `x.com/{handle}` via Scrapling's Camoufox stealth browser
- Extracts per-tweet: `text`, `publishedAt`, `tweetUrl` (used as `guid`), `mediaUrls[]`
- Maps to `ScrapedPost` Pydantic model before pushing

**ScrapedPost model:**

```python
class ScrapedPost(BaseModel):
    guid: str          # tweet URL, stable unique identifier
    title: str         # first 100 chars of tweet text
    url: str           # tweet URL
    content: str       # full tweet text
    publishedAt: str   # ISO 8601
    author: str        # @handle
    media: list[dict]  # [{ url, type }] for images/videos
```

### 2. Node.js API Changes

**New file:** `apps/api/src/lib/scraping-client.ts`

- Thin HTTP wrapper calling Python `POST /scrape`
- Passes `INTERNAL_API_KEY` header
- 30s timeout, throws on non-2xx

**New routes** (new file: `apps/api/src/routes/internal-scrapling.ts`):

```
GET /internal/scrapling/feeds
  Auth: INTERNAL_API_KEY header
  Query: subscriptionCount > 0, adapterType = "x_timeline"
  Returns: [{ feedId, handle (extracted from url) }]

POST /internal/scrapling/ingest
  Auth: INTERNAL_API_KEY header
  Body: { feedId: string, posts: ScrapedPost[] }
  Action: batch insert into posts table
  Dedup: existing (feedId, guid) unique constraint — silent on conflict
  Returns: { inserted: number }
```

**Modified:** `apps/api/src/routes/feeds.ts`

- `POST /feeds/:id/refresh`: add branch for `adapterType === "x_timeline"` before existing RSS path
- `POST /feeds`: add support for creating x_timeline feeds from a handle input

**New feed creation convention:**

- `url` stored as `"x_timeline://elonmusk"` (synthetic, unique per handle)
- `adapterType` = `"x_timeline"`
- No DB schema changes required

### 3. Authentication Between Services

Both internal endpoints require an `X-Internal-Key` header matching `INTERNAL_API_KEY` env var. Requests without or with wrong key return 401. This key is set in both the Python service environment and the Vercel API environment.

---

## Data Flow

```
ScrapedPost (Python)
  ↓ POST /internal/scrapling/ingest
Node.js maps to posts table row:
  guid         ← ScrapedPost.guid
  feedId       ← request.feedId
  title        ← ScrapedPost.title
  url          ← ScrapedPost.url
  content      ← ScrapedPost.content
  publishedAt  ← ScrapedPost.publishedAt
  author       ← ScrapedPost.author
  media        ← ScrapedPost.media (JSONB array)
  scrapeStatus ← "scraped" (already full content, skip readability queue)
```

---

## Error Handling

| Failure                                   | Behavior                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| Python service unreachable (user refresh) | Return 503 `"Scraper service unavailable"`, feed shows last-fetched data                 |
| Python service unreachable (background)   | Log error, skip feed, retry next scheduler cycle                                         |
| X scrape blocked / login wall             | Python returns `{ error: "blocked" }`, Node.js sets `feed.errorAt` + `feed.errorMessage` |
| Duplicate posts on ingest                 | Silent no-op via `(feedId, guid)` unique constraint                                      |
| Refresh timeout (>30s)                    | Return 504 to user                                                                       |
| Background scheduler crash                | APScheduler auto-restarts job on next cycle                                              |

---

## Testing

**Python (`pytest`):**

- Unit tests for `XTimelineScraper` using Scrapling's mock/replay mode (no live X requests in CI)
- Unit tests for `ScrapedPost` model validation
- Integration test for `POST /scrape` endpoint with mocked Node.js ingest

**Node.js (Vitest + MSW):**

- Mock `scraplingClient.scrape()` in `feeds.test.ts` for the refresh branch
- Integration test for `POST /internal/scrapling/ingest` with real DB (same pattern as existing API tests)
- Unit test for internal key auth middleware

---

## Deployment

- Python service deployed on Railway or Fly.io as a persistent process
- Environment variables: `NODE_API_URL`, `INTERNAL_API_KEY`, any X session cookies Scrapling needs
- Node.js API on Vercel: add `INTERNAL_API_KEY`, `SCRAPER_SERVICE_URL` env vars
- No changes to existing Vercel config or build pipeline

---

## Out of Scope (Post-MVP)

- GitHub non-RSS data (activity, issues)
- Reddit, HackerNews, or other sources
- Persistent browser tab monitoring for real-time updates
- Adaptive polling intervals based on account activity
- X authentication (scraping public timelines only for MVP)
