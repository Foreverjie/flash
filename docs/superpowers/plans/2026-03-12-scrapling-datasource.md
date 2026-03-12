# Scrapling Data Source Module Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Python Scrapling microservice that scrapes X (Twitter) user timelines and pushes posts into the existing Folo API, enabling users to subscribe to X accounts as feeds.

**Architecture:** A FastAPI Python service deployed on Railway/Fly.io runs Scrapling+Camoufox to scrape X timelines. It polls the Node.js API for subscribed x_timeline feeds every 15 minutes (background mode) and also exposes `POST /scrape` for on-demand scraping triggered by user refresh. The Node.js API gains two internal endpoints protected by a shared secret: one to list active scrapling feeds and one to ingest scraped posts.

**Tech Stack:** Python 3.11+, FastAPI, Scrapling (Camoufox), APScheduler, httpx, pytest; TypeScript/Hono (existing), Vitest (existing)

---

## Chunk 1: Python Scrapling Service

### Task 1: Python project scaffold

**Files:**

- Create: `apps/scraper/requirements.txt`
- Create: `apps/scraper/config.py`

- [ ] **Step 1: Create requirements.txt**

```
# apps/scraper/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.6
scrapling==0.2.9
camoufox[geoip]==0.4.11
apscheduler==3.10.4
httpx==0.27.2
pydantic==2.8.2
pydantic-settings==2.4.0
pytest==8.3.3
pytest-asyncio==0.24.0
respx==0.21.1
```

- [ ] **Step 2: Create config.py**

```python
# apps/scraper/config.py
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    node_api_url: str = "http://localhost:3001"
    internal_api_key: str = "dev-secret"
    scrape_interval_minutes: int = 15
    scrape_timeout_seconds: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
```

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/requirements.txt apps/scraper/config.py
git commit -m "feat(scraper): add Python project scaffold with config"
```

---

### Task 2: ScrapedPost model

**Files:**

- Create: `apps/scraper/models.py`
- Create: `apps/scraper/tests/__init__.py`
- Create: `apps/scraper/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/scraper/tests/test_models.py
import pytest
from pydantic import ValidationError

from scraper.models import ScrapedPost


def test_scraped_post_requires_guid():
    with pytest.raises(ValidationError):
        ScrapedPost(title="hi", url="https://x.com/foo/1", content="hi",
                    published_at="2026-01-01T00:00:00Z", author="foo")


def test_scraped_post_title_truncated_to_100_chars():
    long_text = "a" * 200
    post = ScrapedPost(
        guid="https://x.com/foo/status/1",
        title=long_text,  # pass the full 200-char string — validator must truncate it
        url="https://x.com/foo/status/1",
        content=long_text,
        published_at="2026-01-01T00:00:00Z",
        author="foo",
    )
    assert len(post.title) == 100


def test_scraped_post_media_defaults_to_empty_list():
    post = ScrapedPost(
        guid="https://x.com/foo/status/1",
        title="Hello",
        url="https://x.com/foo/status/1",
        content="Hello world",
        published_at="2026-01-01T00:00:00Z",
        author="foo",
    )
    assert post.media == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/scraper && python -m pytest tests/test_models.py -v
```

Expected: `ModuleNotFoundError: No module named 'scraper'`

- [ ] **Step 3: Create models.py**

```python
# apps/scraper/models.py
from pydantic import BaseModel, field_validator


class ScrapedPost(BaseModel):
    guid: str                    # tweet URL — stable unique identifier
    title: str                   # first ≤100 chars of tweet text
    url: str                     # tweet URL
    content: str                 # full tweet text
    published_at: str            # ISO 8601
    author: str                  # @handle (without @)
    media: list[dict] = []       # [{"url": str, "type": "image"|"video"}]

    @field_validator("title")
    @classmethod
    def truncate_title(cls, v: str) -> str:
        return v[:100]


class IngestRequest(BaseModel):
    feed_id: str
    posts: list[ScrapedPost]


class ScrapeRequest(BaseModel):
    feed_id: str
    handle: str
```

- [ ] **Step 4: Add `__init__.py` files so imports work**

```bash
touch apps/scraper/__init__.py apps/scraper/tests/__init__.py
```

- [ ] **Step 5: Run tests from the right working directory**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_models.py -v
```

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/scraper/models.py apps/scraper/__init__.py apps/scraper/tests/__init__.py apps/scraper/tests/test_models.py
git commit -m "feat(scraper): add ScrapedPost pydantic model with tests"
```

---

### Task 3: Node.js API HTTP client

**Files:**

- Create: `apps/scraper/client.py`
- Create: `apps/scraper/tests/test_client.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/scraper/tests/test_client.py
import pytest
import httpx
import respx

from scraper.client import NodeApiClient
from scraper.models import ScrapedPost


@pytest.fixture
def client():
    return NodeApiClient(base_url="http://test-api", api_key="test-key")


@respx.mock
@pytest.mark.asyncio
async def test_get_scrapling_feeds_returns_list(client):
    respx.get("http://test-api/internal/scrapling/feeds").mock(
        return_value=httpx.Response(200, json={"data": [{"feedId": "1", "handle": "foo"}]})
    )
    feeds = await client.get_scrapling_feeds()
    assert feeds == [{"feedId": "1", "handle": "foo"}]


@respx.mock
@pytest.mark.asyncio
async def test_ingest_posts_returns_inserted_count(client):
    post = ScrapedPost(
        guid="https://x.com/foo/status/1",
        title="Hello",
        url="https://x.com/foo/status/1",
        content="Hello world",
        published_at="2026-01-01T00:00:00Z",
        author="foo",
    )
    respx.post("http://test-api/internal/scrapling/ingest").mock(
        return_value=httpx.Response(200, json={"data": {"inserted": 1}})
    )
    result = await client.ingest_posts(feed_id="1", posts=[post])
    assert result == 1


@respx.mock
@pytest.mark.asyncio
async def test_get_scrapling_feeds_sends_auth_header(client):
    route = respx.get("http://test-api/internal/scrapling/feeds").mock(
        return_value=httpx.Response(200, json={"data": []})
    )
    await client.get_scrapling_feeds()
    assert route.calls[0].request.headers["x-internal-key"] == "test-key"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_client.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'scraper.client'`

- [ ] **Step 3: Create client.py**

```python
# apps/scraper/client.py
import httpx

from scraper.models import ScrapedPost


class NodeApiClient:
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        self._base_url = base_url.rstrip("/")
        self._headers = {"x-internal-key": api_key, "content-type": "application/json"}
        self._timeout = timeout

    async def get_scrapling_feeds(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            resp = await http.get(
                f"{self._base_url}/internal/scrapling/feeds",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json().get("data", [])

    async def ingest_posts(self, feed_id: str, posts: list[ScrapedPost]) -> int:
        payload = {
            "feedId": feed_id,
            "posts": [p.model_dump(by_alias=False) for p in posts],
        }
        async with httpx.AsyncClient(timeout=self._timeout) as http:
            resp = await http.post(
                f"{self._base_url}/internal/scrapling/ingest",
                json=payload,
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json().get("data", {}).get("inserted", 0)
```

- [ ] **Step 4: Install test deps and run**

```bash
cd apps/scraper && pip install -r requirements.txt respx pytest-asyncio
PYTHONPATH=.. python -m pytest tests/test_client.py -v
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/client.py apps/scraper/tests/test_client.py
git commit -m "feat(scraper): add NodeApiClient with tests"
```

---

### Task 4: BaseScraper and XTimelineScraper

**Files:**

- Create: `apps/scraper/scrapers/__init__.py`
- Create: `apps/scraper/scrapers/base.py`
- Create: `apps/scraper/scrapers/x_timeline.py`
- Create: `apps/scraper/tests/test_x_timeline.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/scraper/tests/test_x_timeline.py
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from scraper.scrapers.x_timeline import XTimelineScraper
from scraper.models import ScrapedPost


def make_mock_tweet(tweet_id: str, text: str, timestamp: str, media_urls: list[str] = []):
    tweet = MagicMock()
    tweet.get.side_effect = lambda key, default=None: {
        "data-tweet-id": tweet_id,
        "href": f"https://x.com/testuser/status/{tweet_id}",
    }.get(key, default)
    tweet.css_first.return_value = MagicMock()
    tweet.css_first.return_value.text = text
    return tweet


@pytest.mark.asyncio
async def test_scrape_returns_scraped_posts():
    scraper = XTimelineScraper()
    mock_posts = [
        ScrapedPost(
            guid="https://x.com/elonmusk/status/1",
            title="Hello world",
            url="https://x.com/elonmusk/status/1",
            content="Hello world this is a tweet",
            published_at="2026-01-01T00:00:00Z",
            author="elonmusk",
        )
    ]
    with patch.object(scraper, "_fetch_timeline", new=AsyncMock(return_value=mock_posts)):
        result = await scraper.scrape("elonmusk")
    assert len(result) == 1
    assert result[0].author == "elonmusk"
    assert result[0].guid.startswith("https://x.com/")


@pytest.mark.asyncio
async def test_scrape_returns_empty_on_blocked():
    scraper = XTimelineScraper()
    with patch.object(scraper, "_fetch_timeline", new=AsyncMock(return_value=[])):
        result = await scraper.scrape("someuser")
    assert result == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_x_timeline.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'scraper.scrapers'`

- [ ] **Step 3: Create base.py**

```python
# apps/scraper/scrapers/base.py
from abc import ABC, abstractmethod

from scraper.models import ScrapedPost


class BaseScraper(ABC):
    @abstractmethod
    async def scrape(self, handle: str) -> list[ScrapedPost]:
        """Scrape content for the given handle. Returns empty list on failure."""
        ...
```

- [ ] **Step 4: Create x_timeline.py**

```python
# apps/scraper/scrapers/x_timeline.py
import logging
from datetime import datetime, timezone

from scrapling import StealthyFetcher

from scraper.models import ScrapedPost
from scraper.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

X_TIMELINE_URL = "https://x.com/{handle}"


class XTimelineScraper(BaseScraper):
    async def scrape(self, handle: str) -> list[ScrapedPost]:
        try:
            return await self._fetch_timeline(handle)
        except Exception as exc:
            logger.error("XTimelineScraper failed for @%s: %s", handle, exc)
            return []

    async def _fetch_timeline(self, handle: str) -> list[ScrapedPost]:
        url = X_TIMELINE_URL.format(handle=handle)
        page = await StealthyFetcher.async_fetch(url, headless=True, network_idle=True)

        posts: list[ScrapedPost] = []

        # X renders tweets as articles with data-testid="tweet"
        tweet_articles = page.css('[data-testid="tweet"]')

        for article in tweet_articles:
            try:
                post = self._parse_tweet(article, handle)
                if post:
                    posts.append(post)
            except Exception as exc:
                logger.warning("Failed to parse tweet for @%s: %s", handle, exc)
                continue

        return posts

    def _parse_tweet(self, article, handle: str) -> ScrapedPost | None:
        # Extract tweet text
        text_el = article.css_first('[data-testid="tweetText"]')
        if not text_el:
            return None
        text = text_el.text.strip()

        # Extract tweet URL from the timestamp link
        time_el = article.css_first("time")
        link_el = time_el.parent if time_el else None
        tweet_url = link_el.attrib.get("href", "") if link_el else ""
        if tweet_url and not tweet_url.startswith("http"):
            tweet_url = f"https://x.com{tweet_url}"

        if not tweet_url:
            return None

        # Extract timestamp
        published_at = (
            time_el.attrib.get("datetime", datetime.now(timezone.utc).isoformat())
            if time_el
            else datetime.now(timezone.utc).isoformat()
        )

        # Extract media (images/videos)
        media: list[dict] = []
        for img in article.css('[data-testid="tweetPhoto"] img'):
            src = img.attrib.get("src", "")
            if src:
                media.append({"url": src, "type": "image"})

        return ScrapedPost(
            guid=tweet_url,
            title=text[:100],
            url=tweet_url,
            content=text,
            published_at=published_at,
            author=handle,
            media=media,
        )
```

- [ ] **Step 5: Create scrapers/**init**.py**

```bash
touch apps/scraper/scrapers/__init__.py
```

- [ ] **Step 6: Run tests**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_x_timeline.py -v
```

Expected: 2 tests PASS (using mocked `_fetch_timeline`, no live X request)

- [ ] **Step 7: Commit**

```bash
git add apps/scraper/scrapers/ apps/scraper/tests/test_x_timeline.py
git commit -m "feat(scraper): add XTimelineScraper with Scrapling+Camoufox"
```

---

### Task 5: FastAPI app with /scrape and /health endpoints

**Files:**

- Create: `apps/scraper/main.py`
- Create: `apps/scraper/tests/test_api.py`

- [ ] **Step 1: Write the failing tests**

```python
# apps/scraper/tests/test_api.py
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from scraper.main import app


@pytest.mark.asyncio
async def test_health_returns_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_scrape_triggers_scraper_and_returns_inserted():
    mock_posts = []  # empty — no new posts
    with (
        patch("scraper.main.scraper.scrape", new=AsyncMock(return_value=mock_posts)),
        patch("scraper.main.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/scrape", json={"feed_id": "123", "handle": "elonmusk"})
    assert resp.status_code == 200
    assert resp.json()["inserted"] == 0


@pytest.mark.asyncio
async def test_scrape_returns_inserted_count_from_ingest():
    from scraper.models import ScrapedPost
    mock_post = ScrapedPost(
        guid="https://x.com/foo/status/1",
        title="Hello",
        url="https://x.com/foo/status/1",
        content="Hello",
        published_at="2026-01-01T00:00:00Z",
        author="foo",
    )
    with (
        patch("scraper.main.scraper.scrape", new=AsyncMock(return_value=[mock_post])),
        patch("scraper.main.node_client.ingest_posts", new=AsyncMock(return_value=1)),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post("/scrape", json={"feed_id": "123", "handle": "foo"})
    assert resp.json()["inserted"] == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_api.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'scraper.main'`

- [ ] **Step 3: Create main.py**

```python
# apps/scraper/main.py
import logging

from fastapi import FastAPI

from scraper.client import NodeApiClient
from scraper.config import settings
from scraper.models import ScrapeRequest
from scraper.scrapers.x_timeline import XTimelineScraper

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Scrapling Service")

scraper = XTimelineScraper()
node_client = NodeApiClient(
    base_url=settings.node_api_url,
    api_key=settings.internal_api_key,
    timeout=settings.scrape_timeout_seconds,
)


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/scrape")
async def scrape(req: ScrapeRequest):
    posts = await scraper.scrape(req.handle)
    inserted = 0
    if posts:
        inserted = await node_client.ingest_posts(feed_id=req.feed_id, posts=posts)
    logger.info("Scraped @%s: %d new posts inserted", req.handle, inserted)
    return {"inserted": inserted}
```

- [ ] **Step 4: Run tests**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_api.py -v
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/scraper/main.py apps/scraper/tests/test_api.py
git commit -m "feat(scraper): add FastAPI app with /scrape and /health endpoints"
```

---

### Task 6: APScheduler background loop

**Files:**

- Create: `apps/scraper/scheduler.py`
- Create: `apps/scraper/tests/test_scheduler.py`

- [ ] **Step 1: Write the failing test**

```python
# apps/scraper/tests/test_scheduler.py
import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_sync_all_feeds_calls_scrape_for_each_feed():
    from scraper.scheduler import sync_all_feeds

    mock_feeds = [
        {"feedId": "1", "handle": "elonmusk"},
        {"feedId": "2", "handle": "sama"},
    ]

    mock_scrape = AsyncMock(return_value=[])
    with (
        patch("scraper.scheduler.node_client.get_scrapling_feeds", new=AsyncMock(return_value=mock_feeds)),
        patch("scraper.scheduler.scraper.scrape", new=mock_scrape),
        patch("scraper.scheduler.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        await sync_all_feeds()

    assert mock_scrape.call_count == 2
    mock_scrape.assert_any_call("elonmusk")
    mock_scrape.assert_any_call("sama")


@pytest.mark.asyncio
async def test_sync_all_feeds_skips_failed_feed_and_continues():
    from scraper.scheduler import sync_all_feeds

    mock_feeds = [
        {"feedId": "1", "handle": "baduser"},
        {"feedId": "2", "handle": "gooduser"},
    ]

    async def scrape_side_effect(handle):
        if handle == "baduser":
            raise RuntimeError("blocked")
        return []

    with (
        patch("scraper.scheduler.node_client.get_scrapling_feeds", new=AsyncMock(return_value=mock_feeds)),
        patch("scraper.scheduler.scraper.scrape", side_effect=scrape_side_effect),
        patch("scraper.scheduler.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        # Should not raise — failure on one feed must not abort others
        await sync_all_feeds()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_scheduler.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'scraper.scheduler'`

- [ ] **Step 3: Create scheduler.py**

```python
# apps/scraper/scheduler.py
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from scraper.client import NodeApiClient
from scraper.config import settings
from scraper.scrapers.x_timeline import XTimelineScraper

logger = logging.getLogger(__name__)

scraper = XTimelineScraper()
node_client = NodeApiClient(
    base_url=settings.node_api_url,
    api_key=settings.internal_api_key,
)


async def sync_all_feeds() -> None:
    feeds = await node_client.get_scrapling_feeds()
    logger.info("Background sync: %d feeds to scrape", len(feeds))

    for feed in feeds:
        feed_id = feed["feedId"]
        handle = feed["handle"]
        try:
            posts = await scraper.scrape(handle)
            if posts:
                inserted = await node_client.ingest_posts(feed_id=feed_id, posts=posts)
                logger.info("@%s: %d new posts", handle, inserted)
        except Exception as exc:
            logger.error("Failed to sync @%s (feedId=%s): %s", handle, feed_id, exc)


def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        sync_all_feeds,
        trigger="interval",
        minutes=settings.scrape_interval_minutes,
        id="sync_all_feeds",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: sync every %d min", settings.scrape_interval_minutes)
    return scheduler
```

- [ ] **Step 4: Wire scheduler into FastAPI app startup** — edit `apps/scraper/main.py`, add lifespan:

```python
# apps/scraper/main.py  — replace the FastAPI instantiation with:
from contextlib import asynccontextmanager
from scraper.scheduler import start_scheduler

_scheduler = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler
    _scheduler = start_scheduler()
    yield
    if _scheduler:
        _scheduler.shutdown()

app = FastAPI(title="Scrapling Service", lifespan=lifespan)
```

- [ ] **Step 4b: Prevent scheduler from starting during tests** — edit `tests/test_api.py` to add a `no_scheduler` fixture. The Task 5 block already imports `from unittest.mock import AsyncMock, patch` — extend that import to add `MagicMock`, then add the fixture before the existing tests:

```python
# In apps/scraper/tests/test_api.py:
# 1. Change the existing import line from:
#    from unittest.mock import AsyncMock, patch
# to:
from unittest.mock import AsyncMock, MagicMock, patch

# 2. Add this fixture before the existing test functions:

# Autouse fixture: prevent real APScheduler from starting during tests
@pytest.fixture(autouse=True)
def no_scheduler():
    mock_sched = MagicMock()
    with patch("scraper.main.start_scheduler", return_value=mock_sched):
        yield
```

- [ ] **Step 5: Run scheduler tests**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/test_scheduler.py -v
```

Expected: 2 tests PASS

- [ ] **Step 6: Run all Python tests**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/scraper/scheduler.py apps/scraper/tests/test_scheduler.py apps/scraper/main.py
git commit -m "feat(scraper): add APScheduler background sync loop"
```

---

## Chunk 2: Node.js API Changes

### Task 7: scraping-client.ts

**Files:**

- Create: `apps/api/src/lib/scraping-client.ts`
- Create: `apps/api/src/lib/scraping-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/lib/scraping-client.test.ts
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { ScrapingClient } from "./scraping-client"

const server = setupServer()

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("ScrapingClient", () => {
  const client = new ScrapingClient("http://scraper.test", "test-key")

  it("calls POST /scrape with feedId and handle", async () => {
    let capturedBody: unknown
    server.use(
      http.post("http://scraper.test/scrape", async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({ inserted: 3 })
      }),
    )

    const result = await client.scrape({ feedId: "123", handle: "elonmusk" })
    expect(result).toEqual({ inserted: 3 })
    expect(capturedBody).toEqual({ feed_id: "123", handle: "elonmusk" })
  })

  it("sends X-Internal-Key header", async () => {
    let capturedKey: string | null = null
    server.use(
      http.post("http://scraper.test/scrape", ({ request }) => {
        capturedKey = request.headers.get("x-internal-key")
        return HttpResponse.json({ inserted: 0 })
      }),
    )

    await client.scrape({ feedId: "1", handle: "foo" })
    expect(capturedKey).toBe("test-key")
  })

  it("throws on non-2xx response", async () => {
    server.use(
      http.post("http://scraper.test/scrape", () =>
        HttpResponse.json({ error: "unavailable" }, { status: 503 }),
      ),
    )

    await expect(client.scrape({ feedId: "1", handle: "foo" })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/lib/scraping-client.test.ts
```

Expected: FAIL — `Cannot find module './scraping-client'`

- [ ] **Step 3: Create scraping-client.ts**

```typescript
// apps/api/src/lib/scraping-client.ts

export interface ScrapeParams {
  feedId: string
  handle: string
}

export interface ScrapeResult {
  inserted: number
}

export class ScrapingClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async scrape(params: ScrapeParams): Promise<ScrapeResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const resp = await fetch(`${this.baseUrl}/scrape`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-key": this.apiKey,
        },
        body: JSON.stringify({ feed_id: params.feedId, handle: params.handle }),
        signal: controller.signal,
      })

      if (!resp.ok) {
        throw new Error(`Scraping service error: ${resp.status}`)
      }

      return (await resp.json()) as ScrapeResult
    } finally {
      clearTimeout(timer)
    }
  }
}

// Singleton — configured from env
export const scrapingClient = new ScrapingClient(
  process.env.SCRAPER_SERVICE_URL ?? "http://localhost:8000",
  process.env.INTERNAL_API_KEY ?? "dev-secret",
)
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && pnpm vitest run src/lib/scraping-client.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/scraping-client.ts apps/api/src/lib/scraping-client.test.ts
git commit -m "feat(api): add ScrapingClient for calling Python scraper service"
```

---

### Task 8: Internal scrapling routes (GET /feeds, POST /ingest)

**Files:**

- Create: `apps/api/src/routes/internal-scrapling.ts`
- Create: `apps/api/src/routes/internal-scrapling.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/api/src/routes/internal-scrapling.test.ts
import { Hono } from "hono"
import { describe, expect, it } from "vitest"

import internalScraplingRouter from "./internal-scrapling"

// Helper: mount router with internal key
function makeApp(internalKey = "test-key") {
  const app = new Hono()
  app.use("*", async (c, next) => {
    // simulate env
    process.env.INTERNAL_API_KEY = internalKey
    await next()
  })
  app.route("/internal/scrapling", internalScraplingRouter)
  return app
}

describe("GET /internal/scrapling/feeds", () => {
  it("returns 401 without correct key", async () => {
    const app = makeApp("real-key")
    const res = await app.request("/internal/scrapling/feeds", {
      headers: { "x-internal-key": "wrong-key" },
    })
    expect(res.status).toBe(401)
  })

  it("returns 200 with feed list when key is valid", async () => {
    const app = makeApp("test-key")
    const res = await app.request("/internal/scrapling/feeds", {
      headers: { "x-internal-key": "test-key" },
    })
    // DB may be empty in unit test — just check shape
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("data")
    expect(Array.isArray(body.data)).toBe(true)
  })
})

describe("POST /internal/scrapling/ingest", () => {
  it("returns 401 without correct key", async () => {
    const app = makeApp("real-key")
    const res = await app.request("/internal/scrapling/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": "wrong" },
      body: JSON.stringify({ feedId: "1", posts: [] }),
    })
    expect(res.status).toBe(401)
  })

  it("returns 400 when feedId is missing", async () => {
    const app = makeApp("test-key")
    const res = await app.request("/internal/scrapling/ingest", {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": "test-key" },
      body: JSON.stringify({ posts: [] }),
    })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && pnpm vitest run src/routes/internal-scrapling.test.ts
```

Expected: FAIL — `Cannot find module './internal-scrapling'`

- [ ] **Step 3: Create internal-scrapling.ts**

```typescript
// apps/api/src/routes/internal-scrapling.ts
import { zValidator } from "@hono/zod-validator"
import { and, eq, gt } from "drizzle-orm"
import { Hono } from "hono"
import { z } from "zod"

import { db, feeds, posts } from "../db/index.js"
import { generateSnowflakeId } from "../utils/id.js"
import { logger } from "../utils/logger.js"
import { sendNotFound, structuredSuccess } from "../utils/response.js"

const router = new Hono()

// Middleware: require internal API key
router.use("*", async (c, next) => {
  const key = c.req.header("x-internal-key")
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return c.json({ code: 401, message: "Unauthorized" }, 401)
  }
  await next()
})

const scrapedPostSchema = z.object({
  guid: z.string().min(1),
  title: z.string().max(200),
  url: z.string().url(),
  content: z.string(),
  published_at: z.string(),
  author: z.string(),
  media: z.array(z.object({ url: z.string(), type: z.string() })).default([]),
})

/**
 * GET /internal/scrapling/feeds
 * Returns x_timeline feeds with at least one subscriber.
 * Used by the Python service to know which accounts to scrape.
 */
router.get("/feeds", async (c) => {
  const activeFeeds = await db.query.feeds.findMany({
    where: and(eq(feeds.adapterType, "x_timeline"), gt(feeds.subscriptionCount, 0)),
    columns: { id: true, url: true },
  })

  const result = activeFeeds.map((f) => ({
    feedId: f.id,
    // url is stored as "x_timeline://handle" — extract the handle
    handle: f.url.replace("x_timeline://", ""),
  }))

  return c.json(structuredSuccess(result))
})

/**
 * POST /internal/scrapling/ingest
 * Receives scraped posts from the Python service and inserts them.
 */
router.post(
  "/ingest",
  zValidator(
    "json",
    z.object({
      feedId: z.string().min(1),
      posts: z.array(scrapedPostSchema),
    }),
  ),
  async (c) => {
    const { feedId, posts: incomingPosts } = c.req.valid("json")

    // Verify feed exists and is x_timeline type
    const feed = await db.query.feeds.findFirst({
      where: and(eq(feeds.id, feedId), eq(feeds.adapterType, "x_timeline")),
    })

    if (!feed) {
      return sendNotFound(c, "Feed")
    }

    let inserted = 0
    for (const item of incomingPosts) {
      const result = await db
        .insert(posts)
        .values({
          id: generateSnowflakeId(),
          feedId,
          guid: item.guid,
          title: item.title,
          url: item.url,
          content: item.content,
          author: item.author,
          publishedAt: new Date(item.published_at),
          media: item.media,
          scrapeStatus: "scraped", // already full content — skip readability queue
        })
        .onConflictDoNothing() // (feedId, guid) unique — silent dedup
        .returning({ id: posts.id })
      // Only count posts that were actually inserted (not conflict-skipped)
      if (result.length > 0) inserted++
    }

    await db
      .update(feeds)
      .set({ lastFetchedAt: new Date(), errorAt: null, errorMessage: null })
      .where(eq(feeds.id, feedId))

    logger.info("[Scrapling] Ingested %d posts for feedId=%s", inserted, feedId)
    return c.json(structuredSuccess({ inserted }))
  },
)

export default router
```

- [ ] **Step 4: Run tests**

```bash
cd apps/api && pnpm vitest run src/routes/internal-scrapling.test.ts
```

Expected: all auth/validation tests PASS (DB tests may be skipped in unit mode)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/internal-scrapling.ts apps/api/src/routes/internal-scrapling.test.ts
git commit -m "feat(api): add internal scrapling routes for feed list and post ingest"
```

---

### Task 9: Modify feeds.ts refresh to delegate x_timeline feeds to Python service

**Files:**

- Modify: `apps/api/src/routes/feeds.ts` (around line 285)

- [ ] **Step 1: Write the failing test** — create `apps/api/src/routes/feeds.test.ts`:

```typescript
// apps/api/src/routes/feeds.test.ts
import { Hono } from "hono"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Mock DB — must be hoisted before any imports that pull in feeds.ts
vi.mock("../db/index.js", () => ({
  db: {
    query: { feeds: { findFirst: vi.fn() } },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    }),
  },
  feeds: {},
  posts: {},
}))

// Bypass auth for unit tests
vi.mock("../middleware/auth.js", () => ({
  requireAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
  optionalAuth: vi.fn(async (_c: unknown, next: () => Promise<void>) => next()),
}))

const server = setupServer()
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe("POST /feeds/:id/refresh — x_timeline branch", () => {
  beforeEach(async () => {
    // Reset module registry so feeds.ts re-imports with fresh mocks
    vi.resetModules()
    // Point scrapingClient at the MSW intercept URL
    process.env.SCRAPER_SERVICE_URL = "http://scraper.test"
  })

  it("returns newPosts from scraping service for x_timeline feed", async () => {
    const { db } = await import("../db/index.js")
    ;(db.query.feeds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "feed-123",
      url: "x_timeline://elonmusk",
      adapterType: "x_timeline",
    })

    server.use(http.post("http://scraper.test/scrape", () => HttpResponse.json({ inserted: 3 })))

    const { default: feedsRouter } = await import("./feeds.js")
    const app = new Hono()
    app.route("/feeds", feedsRouter)

    const res = await app.request("/feeds/feed-123/refresh", { method: "POST" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.newPosts).toBe(3)
  })
})
```

- [ ] **Step 2: Run test to verify it FAILS (the branch doesn't exist yet)**

```bash
cd apps/api && pnpm vitest run src/routes/feeds.test.ts
```

Expected: FAIL — response is 400 (rssManager.fetch fails for `x_timeline://` URL) or `newPosts` is missing

- [ ] **Step 3: Add x_timeline branch to the refresh handler in feeds.ts**

Find the `POST /:id/refresh` handler (around line 285 in `apps/api/src/routes/feeds.ts`). After fetching the feed record and before calling `rssManager.fetch`, add:

```typescript
// At the top of the file, add import:
import { scrapingClient } from "../lib/scraping-client.js"

// Inside the /:id/refresh handler, after the `if (!feed)` check, add:
// Delegate to Python scraping service for x_timeline feeds
if (feed.adapterType === "x_timeline") {
  try {
    const handle = feed.url.replace("x_timeline://", "")
    const result = await scrapingClient.scrape({ feedId: feed.id, handle })
    return c.json(structuredSuccess({ message: "Feed refreshed", newPosts: result.inserted }))
  } catch (err) {
    logger.error("[Feeds] Scraping service error for feed %s:", id, err)
    await db
      .update(feeds)
      .set({ errorAt: new Date(), errorMessage: "Scraping service unavailable" })
      .where(eq(feeds.id, id))
    return sendError(c, "Scraper service unavailable", 500, 500)
  }
}
```

- [ ] **Step 4: Run full API tests**

```bash
cd apps/api && pnpm vitest run
```

Expected: all existing tests PASS, new test PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/feeds.ts apps/api/src/routes/feeds.test.ts
git commit -m "feat(api): delegate x_timeline feed refresh to Python scraping service"
```

---

### Task 10: Support creating x_timeline feeds

**Files:**

- Modify: `apps/api/src/routes/feeds.ts` (createFeedSchema and POST / handler)

- [ ] **Step 1: Write the failing test** — add to `apps/api/src/routes/feeds.test.ts` (already created in Task 9):

```typescript
// Add inside the existing feeds.test.ts, as a new describe block:
describe("POST /feeds — x_timeline creation", () => {
  beforeEach(async () => {
    vi.resetModules()
    process.env.SCRAPER_SERVICE_URL = "http://scraper.test"
  })

  it("returns 201 with new feed when creating an x_timeline feed by handle", async () => {
    const { db } = await import("../db/index.js")
    // No existing feed found
    ;(db.query.feeds.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    // Simulate insert returning new feed row
    const mockInsert = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([
            { id: "new-feed", url: "x_timeline://elonmusk", adapterType: "x_timeline" },
          ]),
      }),
    })
    ;(db as unknown as Record<string, unknown>).insert = mockInsert

    const { default: feedsRouter } = await import("./feeds.js")
    const app = new Hono()
    app.route("/feeds", feedsRouter)

    const res = await app.request("/feeds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "x_timeline", handle: "@elonmusk" }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.feed.adapterType).toBe("x_timeline")
    expect(body.data.isNew).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it FAILS (union schema not added yet)**

```bash
cd apps/api && pnpm vitest run src/routes/feeds.test.ts
```

Expected: FAIL — Zod validation rejects `{ type: "x_timeline", handle: "@elonmusk" }` since schema only accepts `{ url }`

- [ ] **Step 3: Update `createFeedSchema` in feeds.ts to accept x_timeline handles**

Locate `createFeedSchema` (around line 25 in `feeds.ts`). Replace with:

```typescript
// z.union (not discriminatedUnion) — discriminatedUnion requires a required literal
// on each member, which would break existing callers that omit `type` entirely.
// TypeScript still narrows correctly via `if (body.type === "x_timeline")` below.
const createFeedSchema = z.union([
  // Standard RSS feed (existing callers omit `type`)
  z.object({
    type: z.literal("rss").optional(),
    url: z.string().url("Invalid feed URL"),
    title: z.string().max(200).optional(),
    description: z.string().max(1000).optional(),
  }),
  // X timeline feed — user provides a handle (e.g. "elonmusk" or "@elonmusk")
  z.object({
    type: z.literal("x_timeline"),
    handle: z
      .string()
      .min(1)
      .max(50)
      .transform((h) => h.replace(/^@/, "")), // strip leading @
    title: z.string().max(200).optional(),
  }),
])
```

- [ ] **Step 4: Restructure the POST / handler to narrow the type before destructuring**

The existing handler destructures `{ url, title, description }` directly. After the schema becomes a discriminated union, TypeScript requires type narrowing first. Replace the existing handler body's opening lines with:

```typescript
// In POST / handler, after: const body = c.req.valid("json")
// Replace any existing destructure with a discriminant check:

if (body.type === "x_timeline") {
  // x_timeline feed creation
  const syntheticUrl = `x_timeline://${body.handle}`

  const existing = await db.query.feeds.findFirst({
    where: eq(feeds.url, syntheticUrl),
  })

  if (existing) {
    return c.json(structuredSuccess({ feed: existing, isNew: false }))
  }

  const feedId = generateSnowflakeId()
  const [newFeed] = await db
    .insert(feeds)
    .values({
      id: feedId,
      url: syntheticUrl,
      title: body.title ?? `@${body.handle} on X`,
      adapterType: "x_timeline",
    })
    .returning()

  return c.json(structuredSuccess({ feed: newFeed, isNew: true }), 201)
}

// --- RSS path below (body.type === "rss") ---
// Safe to destructure url/title/description now that x_timeline is handled above
const { url, title, description } = body
```

- [ ] **Step 5: Run typecheck**

```bash
cd apps/api && pnpm run typecheck
```

Expected: no errors — TypeScript narrows correctly via discriminant

- [ ] **Step 6: Run all API tests**

```bash
cd apps/api && pnpm vitest run
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/feeds.ts
git commit -m "feat(api): support creating x_timeline feeds by handle"
```

---

### Task 11: Mount internal-scrapling router in index.ts

**Files:**

- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Add the import and route mount**

In `apps/api/src/index.ts`, after the existing router imports, add:

```typescript
import internalScraplingRouter from "./routes/internal-scrapling.js"
```

After the `app.route("/cron", cronRouter)` lines, add:

```typescript
// Internal routes for scraping service communication
app.route("/internal/scrapling", internalScraplingRouter)
```

Note: no `/api/v1/` mirror — this is an internal service-to-service endpoint, not a public API.

- [ ] **Step 2: Run typecheck**

```bash
cd apps/api && pnpm run typecheck
```

Expected: no errors

- [ ] **Step 3: Run all API tests**

```bash
cd apps/api && pnpm vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): mount internal scrapling router"
```

---

### Task 12: Environment variables documentation

**Files:**

- Create: `apps/scraper/.env.example`
- Modify: `apps/api/.env.example` (or create if not exists)

- [ ] **Step 1: Create Python service env example**

```bash
# apps/scraper/.env.example
NODE_API_URL=http://localhost:3001
INTERNAL_API_KEY=change-me-in-production
SCRAPE_INTERVAL_MINUTES=15
SCRAPE_TIMEOUT_SECONDS=30
```

- [ ] **Step 2: Add vars to API env example**

`apps/api/.env.example` does not yet exist — create it with the full set of required API variables:

```bash
# apps/api/.env.example

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/folo

# Auth
BETTER_AUTH_SECRET=change-me-in-production
BETTER_AUTH_URL=http://localhost:3001

# OAuth (optional)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App
FRONTEND_URL=http://localhost:3000
PORT=3001

# Scrapling service
SCRAPER_SERVICE_URL=http://localhost:8000
INTERNAL_API_KEY=change-me-in-production
```

- [ ] **Step 3: Commit**

```bash
git add apps/scraper/.env.example apps/api/.env.example
git commit -m "docs(scraper): add .env.example for scraping service and API"
```

---

## Final Verification

- [ ] **Run full Node.js test suite from root**

```bash
pnpm run typecheck && pnpm run test
```

Expected: all pass

- [ ] **Run Python tests**

```bash
cd apps/scraper && PYTHONPATH=.. python -m pytest tests/ -v
```

Expected: all pass

- [ ] **Smoke test the Python service locally**

```bash
cd apps/scraper && uvicorn scraper.main:app --reload --port 8000
curl http://localhost:8000/health
# Expected: {"ok":true}
```
