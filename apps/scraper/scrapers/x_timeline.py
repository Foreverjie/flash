import logging
from datetime import datetime, timezone

from scrapling.fetchers import StealthyFetcher

from scraper.models import ScrapedPost
from scraper.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

X_TIMELINE_URL = "https://x.com/{handle}"


class XTimelineScraper(BaseScraper):
    def __init__(self) -> None:
        self._fetcher = StealthyFetcher()

    async def scrape(self, handle: str) -> list[ScrapedPost]:
        normalized_handle = handle.replace("@", "").strip()
        try:
            return await self._fetch_timeline(normalized_handle)
        except Exception as exc:
            logger.error("XTimelineScraper failed for @%s: %s", normalized_handle, exc)
            return []

    async def _fetch_timeline(self, handle: str) -> list[ScrapedPost]:
        url = X_TIMELINE_URL.format(handle=handle)
        page = await self._fetcher.async_fetch(
            url,
            headless=True,
            network_idle=True,
            wait_selector="main",
            timeout=45_000,
        )

        posts: list[ScrapedPost] = []

        # X renders tweets as articles with data-testid="tweet"
        tweet_articles = page.css('[data-testid="tweet"]')
        if not tweet_articles:
            page_text = page.text.lower()
            if any(
                marker in page_text
                for marker in (
                    "join x today",
                    "log in to x",
                    "sign in to x",
                    "something went wrong",
                    "rate limit exceeded",
                )
            ):
                raise RuntimeError(f"X blocked timeline access for @{handle}")

        for article in tweet_articles:
            try:
                post = self._parse_tweet(article, handle)
                if post:
                    posts.append(post)
            except Exception as exc:
                logger.warning("Failed to parse tweet for @%s: %s", handle, exc)
                continue

        return posts

    def _parse_tweet(self, article, handle: str) -> ScrapedPost | None:
        # Extract tweet text
        text_el = article.css_first('[data-testid="tweetText"]')
        if not text_el:
            return None
        text = text_el.text.strip()

        # Extract tweet URL from the timestamp link
        time_el = article.css_first("time")
        link_el = time_el.parent if time_el else None
        tweet_url = link_el.attrib.get("href", "") if link_el else ""
        if tweet_url and not tweet_url.startswith("http"):
            tweet_url = f"https://x.com{tweet_url}"

        if not tweet_url:
            return None

        # Extract timestamp
        published_at = (
            time_el.attrib.get("datetime", datetime.now(timezone.utc).isoformat())
            if time_el
            else datetime.now(timezone.utc).isoformat()
        )

        # Extract media (images/videos)
        media: list[dict] = []
        for img in article.css('[data-testid="tweetPhoto"] img'):
            src = img.attrib.get("src", "")
            if src:
                media.append({"url": src, "type": "image"})

        return ScrapedPost(
            guid=tweet_url,
            title=text,
            url=tweet_url,
            content=text,
            published_at=published_at,
            author=handle,
            media=media,
        )
