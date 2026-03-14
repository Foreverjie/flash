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
