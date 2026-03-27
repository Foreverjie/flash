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
    fake_scraper.scrape = AsyncMock(return_value=[])
    with (
        patch("scraper.scheduler.node_client.get_scrapling_feeds", new=AsyncMock(return_value=mock_feeds)),
        patch.dict("scraper.scheduler.scrapers", {"x_timeline": fake_scraper}, clear=False),
        patch("scraper.scheduler.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        await sync_all_feeds()

    assert fake_scraper.scrape.call_count == 2
    fake_scraper.scrape.assert_any_call("elonmusk")
    fake_scraper.scrape.assert_any_call("sama")


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
    fake_scraper.scrape = AsyncMock(side_effect=scrape_side_effect)
    with (
        patch("scraper.scheduler.node_client.get_scrapling_feeds", new=AsyncMock(return_value=mock_feeds)),
        patch.dict("scraper.scheduler.scrapers", {"x_timeline": fake_scraper}, clear=False),
        patch("scraper.scheduler.node_client.ingest_posts", new=AsyncMock(return_value=0)),
    ):
        # Should not raise — failure on one feed must not abort others
        await sync_all_feeds()
