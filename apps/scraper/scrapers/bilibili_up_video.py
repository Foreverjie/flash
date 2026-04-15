import asyncio
import base64
import hashlib
import html
import json
import logging
import random
import re
import time
import urllib.parse
from datetime import datetime, timezone
from typing import TypeVar

import httpx

from scraper.config import settings
from scraper.models import ScrapedPost
from scraper.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

BILIBILI_UP_API_URL = "https://api.bilibili.com/x/space/arc/search"
BILIBILI_UP_WBI_API_URL = "https://api.bilibili.com/x/space/wbi/arc/search"
BILIBILI_NAV_URL = "https://api.bilibili.com/x/web-interface/nav"

_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/133.0.0.0 Safari/537.36"
)

_MIXIN_KEY_ENC_TABLE = [
    46, 47, 18, 2, 53, 8, 23, 32,
    15, 50, 10, 31, 58, 3, 45, 35,
    27, 43, 5, 49, 33, 9, 42, 19,
    29, 28, 14, 39, 12, 38, 41, 13,
    37, 48, 7, 16, 24, 55, 40, 61,
    26, 17, 0, 1, 60, 51, 30, 4,
    22, 25, 54, 21, 56, 59, 6, 63,
    57, 62, 11, 36, 20, 34, 44, 52,
]
_WBI_KEY_CACHE: dict[str, tuple[float, str]] = {}
_RENDER_DATA_CACHE: dict[str, tuple[float, str]] = {}

T = TypeVar("T")


def _cache_get(cache: dict[str, tuple[float, T]], key: str) -> T | None:
    cached = cache.get(key)
    if not cached:
        return None

    expires_at, value = cached
    if expires_at <= time.time():
        cache.pop(key, None)
        return None

    return value


def _cache_set(cache: dict[str, tuple[float, T]], key: str, value: T, ttl_seconds: int) -> T:
    cache[key] = (time.time() + ttl_seconds, value)
    return value


def _parse_bilibili_duration(length: str) -> int | None:
    """Parse Bilibili duration string (e.g. "12:34" or "1:02:34") to seconds."""
    if not length:
        return None
    parts = length.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except (ValueError, IndexError):
        return None
    return None


def _b64_trim_last_two(value: str) -> str:
    return base64.b64encode(value.encode()).decode()[:-2]


def _mixin_key(img_key: str, sub_key: str) -> str:
    raw_key = f"{img_key}{sub_key}"
    return "".join(raw_key[i] for i in _MIXIN_KEY_ENC_TABLE if i < len(raw_key))[:32]


def _sign_wbi_params(params: dict[str, object], mixin_key: str, timestamp: int | None = None) -> str:
    signed_params = {k: str(v) for k, v in params.items()}
    signed_params["wts"] = str(timestamp or int(time.time()))

    safe_params = {
        key: re.sub(r"[!'()*]", "", value)
        for key, value in signed_params.items()
    }
    query = urllib.parse.urlencode(sorted(safe_params.items()), quote_via=urllib.parse.quote)
    w_rid = hashlib.md5(f"{query}{mixin_key}".encode()).hexdigest()
    safe_params["w_rid"] = w_rid

    return urllib.parse.urlencode(safe_params, quote_via=urllib.parse.quote)


def _get_dm_img_list() -> str:
    x = max(round(random.gauss(1245, 5)), 0)
    y = max(round(random.gauss(1285, 5)), 0)
    return json.dumps(
        [{
            "x": 3 * x + 2 * y,
            "y": 4 * x - 5 * y,
            "z": 0,
            "timestamp": max(round(random.gauss(30, 5)), 0),
            "type": 0,
        }],
        separators=(",", ":"),
    )


def _get_dm_img_inter_wh(width: int, height: int) -> list[int]:
    seed = random.randrange(114)
    return [2 * width + 2 * height + 3 * seed, 4 * width - height + seed, seed]


def _get_dm_img_inter_of(top: int, left: int) -> list[int]:
    seed = random.randrange(514)
    return [3 * top + 2 * left + seed, 4 * top - 4 * left + 2 * seed, seed]


def _get_dm_img_inter_c(class_name: str) -> str:
    return _b64_trim_last_two(class_name)


def _get_dm_img_inter() -> str:
    p1 = _get_dm_img_inter_wh(274, 601)
    s1 = _get_dm_img_inter_of(134, 30)
    p2 = _get_dm_img_inter_wh(332, 64)
    s2 = _get_dm_img_inter_of(1101, 338)
    return json.dumps(
        {
            "ds": [
                {
                    "t": 2,
                    "c": _get_dm_img_inter_c("clearfix g-search search-container"),
                    "p": [p1[0], p1[2], p1[1]],
                    "s": [s1[2], s1[0], s1[1]],
                },
                {
                    "t": 2,
                    "c": _get_dm_img_inter_c("wrapper"),
                    "p": [p2[0], p2[2], p2[1]],
                    "s": [s2[2], s2[0], s2[1]],
                },
            ],
            "wh": _get_dm_img_inter_wh(1245, 1285),
            "of": _get_dm_img_inter_of(0, 0),
        },
        separators=(",", ":"),
    )


def _build_wbi_params(uid: str, render_data: str, mixin_key: str) -> str:
    params: dict[str, object] = {
        "mid": uid,
        "ps": 30,
        "tid": 0,
        "pn": 1,
        "keyword": "",
        "order": "pubdate",
        "platform": "web",
        "web_location": 1550101,
        "order_avoided": "true",
        "dm_img_list": _get_dm_img_list(),
        "dm_img_str": _b64_trim_last_two("no webgl"),
        "dm_cover_img_str": _b64_trim_last_two("no webgl"),
        "dm_img_inter": _get_dm_img_inter(),
    }
    if render_data:
        params["w_webid"] = render_data

    return _sign_wbi_params(params, mixin_key)


def _bilibili_cookie() -> str:
    return settings.bilibili_cookie


def _bilibili_headers(referer: str, include_origin: bool = False) -> dict[str, str]:
    headers = {
        "accept": "application/json, text/plain, */*",
        "referer": referer,
        "user-agent": _UA,
    }
    if include_origin:
        headers["origin"] = "https://space.bilibili.com"

    cookie = _bilibili_cookie()
    if cookie:
        headers["cookie"] = cookie

    return headers


def _extract_url_key(url: str) -> str:
    return url.rsplit("/", 1)[-1].split(".", 1)[0]


async def _get_wbi_mixin_key() -> str:
    cached = _cache_get(_WBI_KEY_CACHE, "mixin_key")
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=settings.scrape_timeout_seconds) as http:
        resp = await http.get(
            BILIBILI_NAV_URL,
            headers=_bilibili_headers("https://www.bilibili.com/"),
        )
        resp.raise_for_status()

    payload = resp.json()
    img = payload.get("data", {}).get("wbi_img", {})
    img_key = _extract_url_key(img.get("img_url") or "")
    sub_key = _extract_url_key(img.get("sub_url") or "")
    if not img_key or not sub_key:
        raise RuntimeError("Bilibili WBI keys missing from nav response")

    return _cache_set(_WBI_KEY_CACHE, "mixin_key", _mixin_key(img_key, sub_key), 6 * 60 * 60)


async def _get_render_data(uid: str) -> str:
    cached = _cache_get(_RENDER_DATA_CACHE, uid)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(timeout=settings.scrape_timeout_seconds) as http:
        resp = await http.get(
            f"https://space.bilibili.com/{uid}",
            headers=_bilibili_headers("https://www.bilibili.com/"),
        )
        resp.raise_for_status()

    match = re.search(
        r'<script id="__RENDER_DATA__" type="application/json">(.*?)</script>',
        resp.text,
    )
    if not match:
        return _cache_set(_RENDER_DATA_CACHE, uid, "", 10 * 60)

    render_data = json.loads(urllib.parse.unquote(match.group(1)))
    access_id = render_data.get("access_id") or ""
    return _cache_set(_RENDER_DATA_CACHE, uid, access_id, 60 * 60)


async def _curl_get_json(url: str, referer: str) -> dict:
    """Use subprocess curl to avoid TLS fingerprint detection by Bilibili WAF."""
    proc = await asyncio.create_subprocess_exec(
        "curl", "-s", "--max-time", "30",
        "-H", f"referer: {referer}",
        "-H", f"user-agent: {_UA}",
        url,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"curl failed (rc={proc.returncode}): {stderr.decode()}")
    return json.loads(stdout)


async def _fetch_wbi_payload(uid: str) -> dict:
    mixin_key = await _get_wbi_mixin_key()
    render_data = await _get_render_data(uid)
    params = _build_wbi_params(uid, render_data, mixin_key)

    async with httpx.AsyncClient(timeout=settings.scrape_timeout_seconds) as http:
        resp = await http.get(
            f"{BILIBILI_UP_WBI_API_URL}?{params}",
            headers=_bilibili_headers(f"https://space.bilibili.com/{uid}", include_origin=True),
        )
        resp.raise_for_status()

    return resp.json()


async def _fetch_legacy_payload(uid: str) -> dict:
    params = urllib.parse.urlencode({
        "mid": uid, "pn": 1, "ps": 30, "order": "pubdate",
    })
    url = f"{BILIBILI_UP_API_URL}?{params}"
    referer = f"https://space.bilibili.com/{uid}/video"
    return await _curl_get_json(url, referer)


class BilibiliUpVideoScraper(BaseScraper):
    async def scrape(self, source: str) -> list[ScrapedPost]:
        uid = source.strip()
        try:
            return await self._fetch_videos(uid)
        except Exception as exc:
            logger.error("BilibiliUpVideoScraper failed for uid=%s: %s", uid, exc)
            return []

    async def _fetch_videos(self, uid: str) -> list[ScrapedPost]:
        try:
            payload = await _fetch_wbi_payload(uid)
        except Exception as exc:
            logger.warning("Bilibili WBI fetch failed for uid=%s, falling back to curl: %s", uid, exc)
            payload = await _fetch_legacy_payload(uid)

        if payload.get("code") != 0:
            raise RuntimeError(payload.get("message") or f"Bilibili API error for uid={uid}")

        videos = payload.get("data", {}).get("list", {}).get("vlist", []) or []
        posts: list[ScrapedPost] = []

        for video in videos:
            bvid = video.get("bvid")
            if not bvid:
                continue

            title = html.unescape(video.get("title") or "").strip()
            description = html.unescape(video.get("description") or "").strip()
            cover = video.get("pic") or ""
            if cover.startswith("//"):
                cover = f"https:{cover}"

            published_at = datetime.fromtimestamp(
                int(video.get("created") or 0),
                tz=timezone.utc,
            ).isoformat()

            video_url = f"https://www.bilibili.com/video/{bvid}"
            duration = _parse_bilibili_duration(video.get("length") or "")

            media: list[dict] = []
            if cover:
                media.append({"url": cover, "type": "photo"})

            attachments: list[dict] = []
            if duration is not None:
                attachments.append({
                    "url": video_url,
                    "mime_type": "video/mp4",
                    "duration_in_seconds": duration,
                })

            posts.append(
                ScrapedPost(
                    guid=bvid,
                    title=title or bvid,
                    url=video_url,
                    content=description or title or bvid,
                    published_at=published_at,
                    author=video.get("author") or uid,
                    media=media,
                    attachments=attachments,
                )
            )

        return posts
