import urllib.parse
from unittest.mock import patch

import pytest

from scraper.scrapers.bilibili_up_video import (
    BilibiliUpVideoScraper,
    _build_wbi_params,
    _fetch_legacy_payload,
    _mixin_key,
    _parse_bilibili_duration,
    _sign_wbi_params,
)


VIDEO_PAYLOAD = {
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
                    "length": "12:34",
                }
            ]
        }
    },
}


@pytest.mark.asyncio
async def test_scrape_returns_bilibili_videos():
    scraper = BilibiliUpVideoScraper()

    async def mock_fetch_wbi_payload(uid):
        assert uid == "12345"
        return VIDEO_PAYLOAD

    async def mock_fetch_legacy_payload(uid):
        raise AssertionError(f"legacy fetch should not run for uid={uid}")

    with (
        patch("scraper.scrapers.bilibili_up_video._fetch_wbi_payload", new=mock_fetch_wbi_payload),
        patch(
            "scraper.scrapers.bilibili_up_video._fetch_legacy_payload",
            new=mock_fetch_legacy_payload,
        ),
    ):
        posts = await scraper.scrape("12345")

    assert len(posts) == 1
    assert posts[0].guid == "BV1xx411c7mD"
    assert posts[0].url == "https://www.bilibili.com/video/BV1xx411c7mD"
    assert posts[0].title == "Hello & Bilibili"
    assert posts[0].media == [{"url": "https://i0.hdslb.com/test.jpg", "type": "photo"}]
    assert posts[0].attachments == [
        {
            "url": "https://www.bilibili.com/video/BV1xx411c7mD",
            "mime_type": "video/mp4",
            "duration_in_seconds": 754,
        }
    ]


@pytest.mark.asyncio
async def test_scrape_returns_empty_on_api_error():
    scraper = BilibiliUpVideoScraper()

    async def mock_fetch_wbi_payload(_uid):
        return {"code": -400, "message": "bad request"}

    with patch("scraper.scrapers.bilibili_up_video._fetch_wbi_payload", new=mock_fetch_wbi_payload):
        posts = await scraper.scrape("12345")

    assert posts == []


@pytest.mark.asyncio
async def test_scrape_falls_back_to_legacy_payload_when_wbi_fails():
    scraper = BilibiliUpVideoScraper()
    fallback_calls = []

    async def mock_fetch_wbi_payload(_uid):
        raise RuntimeError("blocked")

    async def mock_fetch_legacy_payload(uid):
        fallback_calls.append(uid)
        return VIDEO_PAYLOAD

    with (
        patch("scraper.scrapers.bilibili_up_video._fetch_wbi_payload", new=mock_fetch_wbi_payload),
        patch(
            "scraper.scrapers.bilibili_up_video._fetch_legacy_payload",
            new=mock_fetch_legacy_payload,
        ),
    ):
        posts = await scraper.scrape("12345")

    assert fallback_calls == ["12345"]
    assert len(posts) == 1
    assert posts[0].guid == "BV1xx411c7mD"


def test_mixin_key_uses_bilibili_permutation():
    assert (
        _mixin_key(
            "abcdefghijklmnopqrstuvwxyz012345",
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ678901",
        )
        == "OPscVixApSk56dND1LfRBjKt32oHmGJn"
    )


def test_sign_wbi_params_is_deterministic():
    assert (
        _sign_wbi_params(
            {"foo": "bar", "mid": "12345"},
            "test_mixin_key",
            timestamp=1_700_000_000,
        )
        == "foo=bar&mid=12345&wts=1700000000&w_rid=2da5ddbdabfc3867f4747e5c59adc4c8"
    )


def test_build_wbi_params_includes_bilibili_web_verification_fields():
    with (
        patch("scraper.scrapers.bilibili_up_video._get_dm_img_list", return_value="[]"),
        patch("scraper.scrapers.bilibili_up_video._get_dm_img_inter", return_value="{}"),
        patch(
            "scraper.scrapers.bilibili_up_video._sign_wbi_params",
            wraps=_sign_wbi_params,
        ),
    ):
        query = _build_wbi_params("12345", "access-id", "test_mixin_key")

    params = urllib.parse.parse_qs(query)
    assert params["mid"] == ["12345"]
    assert params["order"] == ["pubdate"]
    assert params["platform"] == ["web"]
    assert params["web_location"] == ["1550101"]
    assert params["w_webid"] == ["access-id"]
    assert params["dm_img_list"] == ["[]"]
    assert params["dm_img_inter"] == ["{}"]
    assert params["wts"]
    assert params["w_rid"]


@pytest.mark.asyncio
async def test_legacy_payload_uses_old_arc_search_endpoint():
    async def mock_get_json(url, referer):
        assert (
            url
            == "https://api.bilibili.com/x/space/arc/search?mid=12345&pn=1&ps=30&order=pubdate"
        )
        assert referer == "https://space.bilibili.com/12345/video"
        return VIDEO_PAYLOAD

    with patch("scraper.scrapers.bilibili_up_video._curl_get_json", new=mock_get_json):
        payload = await _fetch_legacy_payload("12345")

    assert payload == VIDEO_PAYLOAD


def test_parse_bilibili_duration():
    assert _parse_bilibili_duration("12:34") == 754
    assert _parse_bilibili_duration("1:02:34") == 3754
    assert _parse_bilibili_duration("0:05") == 5
    assert _parse_bilibili_duration("") is None
    assert _parse_bilibili_duration("invalid") is None
