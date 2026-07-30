import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_sync_all_feeds_calls_scrape_for_each_feed():
    from scraper.scheduler import sync_all_feeds

    mock_feeds = [
        {"feedId": "1", "adapterType": "x_timeline", "source": "elonmusk"},
        {"feedId": "2", "adapterType": "x_timeline", "source": "sama"},
    ]

    fake_scraper = MagicMock()
    fake_scraper.needs_existing_guids = False
    fake_scraper.scrape = AsyncMock(return_value=[])
    with (
        patch("scraper.scheduler.node_client.get_scrapling_feeds", new=AsyncMock(return_value=mock_feeds)),
        patch.dict("scraper.scheduler.scrapers", {"x_timeline": fake_scraper}, clear=False),
        patch("scraper.scheduler.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        await sync_all_feeds()

    assert fake_scraper.scrape.call_count == 2
    # Scheduled sweeps must not force — that would defeat per-adapter throttles.
    fake_scraper.scrape.assert_any_call("elonmusk", force=False)
    fake_scraper.scrape.assert_any_call("sama", force=False)


@pytest.mark.asyncio
async def test_sync_all_feeds_skips_failed_feed_and_continues():
    from scraper.scheduler import sync_all_feeds

    mock_feeds = [
        {"feedId": "1", "adapterType": "x_timeline", "source": "baduser"},
        {"feedId": "2", "adapterType": "x_timeline", "source": "gooduser"},
    ]

    async def scrape_side_effect(handle):
        if handle == "baduser":
            raise RuntimeError("blocked")
        return []

    fake_scraper = MagicMock()
    fake_scraper.needs_existing_guids = False
    fake_scraper.scrape = AsyncMock(side_effect=scrape_side_effect)
    with (
        patch("scraper.scheduler.node_client.get_scrapling_feeds", new=AsyncMock(return_value=mock_feeds)),
        patch.dict("scraper.scheduler.scrapers", {"x_timeline": fake_scraper}, clear=False),
        patch("scraper.scheduler.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        # Should not raise — failure on one feed must not abort others
        await sync_all_feeds()


@pytest.mark.asyncio
async def test_run_scraper_passes_structured_history_to_community_adapter():
    from scraper.scheduler import run_scraper

    snapshots = [{"guid": "AAA111@243", "property": {"total": "243万"}}]
    fake_client = MagicMock()
    fake_client.get_feed_snapshots = AsyncMock(return_value=snapshots)
    fake_scraper = MagicMock()
    fake_scraper.needs_existing_posts = True
    fake_scraper.scrape = AsyncMock(return_value=[])

    await run_scraper(fake_scraper, fake_client, "feed-1", "9575")

    fake_scraper.scrape.assert_awaited_once_with(
        "9575",
        existing_guids=["AAA111@243"],
        existing_posts=snapshots,
        force=False,
    )
