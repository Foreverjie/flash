import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from scraper.config import settings
from scraper.main import app


# Autouse fixture: prevent real APScheduler from starting during tests
@pytest.fixture(autouse=True)
def no_scheduler():
    mock_sched = MagicMock()
    with patch("scraper.main.start_scheduler", return_value=mock_sched):
        yield


@pytest.mark.asyncio
async def test_health_returns_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


@pytest.mark.asyncio
async def test_scrape_without_key_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/scrape", json={"feed_id": "123", "handle": "elonmusk"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_scrape_triggers_scraper_and_returns_inserted():
    mock_posts = []  # empty — no new posts
    with (
        patch("scraper.main.scraper.scrape", new=AsyncMock(return_value=mock_posts)),
        patch("scraper.main.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/scrape",
                json={"feed_id": "123", "handle": "elonmusk"},
                headers={"x-internal-key": settings.internal_api_key},
            )
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
            resp = await client.post(
                "/scrape",
                json={"feed_id": "123", "handle": "foo"},
                headers={"x-internal-key": settings.internal_api_key},
            )
    assert resp.json()["inserted"] == 1
