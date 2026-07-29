import json
import time
import urllib.parse
from unittest.mock import AsyncMock, patch

import pytest

from scraper.scrapers.bilibili_up_video import (
    BilibiliUpVideoScraper,
    _build_wbi_params,
    _fetch_legacy_payload,
    _impersonated_get_json,
    _is_risk_control,
    _mixin_key,
    _parse_bilibili_duration,
    _sign_wbi_params,
)
from scraper.config import settings
from scraper.scrapers.community_base import IMPERSONATE


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

    with patch("scraper.scrapers.bilibili_up_video._impersonated_get_json", new=mock_get_json):
        payload = await _fetch_legacy_payload("12345")

    assert payload == VIDEO_PAYLOAD


def test_parse_bilibili_duration():
    assert _parse_bilibili_duration("12:34") == 754
    assert _parse_bilibili_duration("1:02:34") == 3754
    assert _parse_bilibili_duration("0:05") == 5
    assert _parse_bilibili_duration("") is None
    assert _parse_bilibili_duration("invalid") is None


class _FakeResponse:
    def __init__(self, status_code, text):
        self.status_code = status_code
        self.text = text


class _FakeSession:
    """Stands in for curl_cffi AsyncSession, recording how it was constructed."""

    last_kwargs: dict = {}

    def __init__(self, **kwargs):
        _FakeSession.last_kwargs = kwargs
        self._response = _FakeSession.response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def get(self, url):
        return self._response


@pytest.mark.asyncio
async def test_impersonated_fetch_uses_browser_fingerprint_not_the_curl_binary():
    """Regression: the fallback used to shell out to `curl`, which is absent
    from the runtime image, so every Bilibili scrape died on FileNotFoundError."""
    _FakeSession.response = _FakeResponse(200, json.dumps(VIDEO_PAYLOAD))

    with patch("scraper.scrapers.bilibili_up_video.AsyncSession", _FakeSession):
        payload = await _impersonated_get_json("https://api.bilibili.com/x", "https://ref")

    assert payload == VIDEO_PAYLOAD
    assert _FakeSession.last_kwargs["impersonate"] == IMPERSONATE
    assert _FakeSession.last_kwargs["headers"]["referer"] == "https://ref"


@pytest.mark.asyncio
async def test_impersonated_fetch_raises_on_bilibili_error_code():
    """A 200 carrying code -799 (rate limited) must not look like success."""
    _FakeSession.response = _FakeResponse(
        200, json.dumps({"code": -799, "message": "\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41"})
    )

    with patch("scraper.scrapers.bilibili_up_video.AsyncSession", _FakeSession):
        with pytest.raises(RuntimeError, match="-799"):
            await _impersonated_get_json("https://api.bilibili.com/x", "https://ref")


@pytest.mark.asyncio
async def test_impersonated_fetch_raises_on_http_error():
    _FakeSession.response = _FakeResponse(412, "")

    with patch("scraper.scrapers.bilibili_up_video.AsyncSession", _FakeSession):
        with pytest.raises(RuntimeError, match="412"):
            await _impersonated_get_json("https://api.bilibili.com/x", "https://ref")


@pytest.mark.asyncio
async def test_scheduled_scrape_is_throttled_between_runs():
    """The scheduler ticks every 15 min; Bilibili must not be hit that often."""
    scraper = BilibiliUpVideoScraper()

    with patch.object(
        BilibiliUpVideoScraper, "_fetch_videos", new=AsyncMock(return_value=[])
    ) as fetch:
        await scraper.scrape("946974")
        await scraper.scrape("946974")

    assert fetch.await_count == 1


@pytest.mark.asyncio
async def test_force_bypasses_the_throttle():
    """Manual refresh must still scrape immediately."""
    scraper = BilibiliUpVideoScraper()

    with patch.object(
        BilibiliUpVideoScraper, "_fetch_videos", new=AsyncMock(return_value=[])
    ) as fetch:
        await scraper.scrape("946974")
        await scraper.scrape("946974", force=True)

    assert fetch.await_count == 2


@pytest.mark.asyncio
async def test_risk_control_rejection_triggers_a_longer_backoff():
    """A -799/-412 must park the uid for bilibili_backoff_minutes, not retry
    at the normal interval — retrying while banned renews the ban."""
    scraper = BilibiliUpVideoScraper()

    with patch.object(
        BilibiliUpVideoScraper,
        "_fetch_videos",
        new=AsyncMock(side_effect=RuntimeError("Bilibili API error -799: too frequent")),
    ):
        assert await scraper.scrape("946974") == []

    blocked_until = scraper._blocked_until["946974"]
    remaining_minutes = (blocked_until - time.time()) / 60
    assert remaining_minutes > settings.bilibili_min_scrape_interval_minutes

    # The backoff binds even force=True: re-requesting while banned renews it.
    with patch.object(
        BilibiliUpVideoScraper, "_fetch_videos", new=AsyncMock(return_value=[])
    ) as fetch:
        await scraper.scrape("946974")
        await scraper.scrape("946974", force=True)
        assert fetch.await_count == 0


def test_risk_control_classifier():
    assert _is_risk_control(RuntimeError("Bilibili API error -799: x"))
    assert _is_risk_control(RuntimeError("returned HTTP 412 for url"))
    assert not _is_risk_control(RuntimeError("Connection reset by peer"))


@pytest.mark.asyncio
async def test_forced_scrape_still_resets_the_throttle_clock():
    """-799 triggers after two rapid requests, so a manual refresh must not be
    followed moments later by a scheduled sweep."""
    scraper = BilibiliUpVideoScraper()

    with patch.object(
        BilibiliUpVideoScraper, "_fetch_videos", new=AsyncMock(return_value=[])
    ) as fetch:
        await scraper.scrape("946974", force=True)
        await scraper.scrape("946974")  # scheduled tick right after

    assert fetch.await_count == 1
