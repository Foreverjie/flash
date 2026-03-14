from unittest.mock import AsyncMock, patch
import pytest

from scraper.scrapers.x_timeline import XTimelineScraper
from scraper.models import ScrapedPost


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
