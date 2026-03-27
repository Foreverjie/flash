from unittest.mock import patch

import httpx
import pytest

from scraper.scrapers.bilibili_up_video import BilibiliUpVideoScraper


@pytest.mark.asyncio
async def test_scrape_returns_bilibili_videos():
    scraper = BilibiliUpVideoScraper()

    payload = {
        "code": 0,
        "data": {
            "list": {
                "vlist": [
                    {
                        "bvid": "BV1xx411c7mD",
                        "title": "Hello &amp; Bilibili",
                        "description": "Video description",
                        "created": 1735689600,
                        "pic": "//i0.hdslb.com/test.jpg",
                        "author": "Test UP",
                    }
                ]
            }
        },
    }

    async def mock_get(self, url, **kwargs):
        return httpx.Response(200, json=payload, request=httpx.Request("GET", url))

    with patch.object(httpx.AsyncClient, "get", new=mock_get):
        posts = await scraper.scrape("12345")

    assert len(posts) == 1
    assert posts[0].guid == "BV1xx411c7mD"
    assert posts[0].url == "https://www.bilibili.com/video/BV1xx411c7mD"
    assert posts[0].title == "Hello & Bilibili"
    assert posts[0].media == [{"url": "https://i0.hdslb.com/test.jpg", "type": "image"}]


@pytest.mark.asyncio
async def test_scrape_returns_empty_on_api_error():
    scraper = BilibiliUpVideoScraper()

    async def mock_get(self, url, **kwargs):
        return httpx.Response(
            200,
            json={"code": -400, "message": "bad request"},
            request=httpx.Request("GET", url),
        )

    with patch.object(httpx.AsyncClient, "get", new=mock_get):
        posts = await scraper.scrape("12345")

    assert posts == []
