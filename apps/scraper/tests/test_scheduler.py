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
