import html
import logging
from datetime import datetime, timezone

import httpx

from scraper.models import ScrapedPost
from scraper.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

BILIBILI_UP_API_URL = "https://api.bilibili.com/x/space/arc/search"


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


class BilibiliUpVideoScraper(BaseScraper):
    async def scrape(self, source: str) -> list[ScrapedPost]:
        uid = source.strip()
        try:
            return await self._fetch_videos(uid)
        except Exception as exc:
            logger.error("BilibiliUpVideoScraper failed for uid=%s: %s", uid, exc)
            return []

    async def _fetch_videos(self, uid: str) -> list[ScrapedPost]:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(
                BILIBILI_UP_API_URL,
                params={
                    "mid": uid,
                    "pn": 1,
                    "ps": 30,
                    "order": "pubdate",
                },
                headers={
                    "referer": f"https://space.bilibili.com/{uid}/video",
                    "user-agent": (
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/133.0.0.0 Safari/537.36"
                    ),
                },
            )
            resp.raise_for_status()

        payload = resp.json()
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
