import logging
import re
import time
from abc import abstractmethod
from datetime import datetime, timezone

from scraper.config import settings
from scraper.models import ScrapedPost
from scraper.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)

_DEFAULT_CITY = "shenzhen"

# Real-estate sites' WAFs block non-browser TLS fingerprints (plain curl/httpx
# get 403), so all fetching goes through curl_cffi browser impersonation.
IMPERSONATE = "chrome124"
HEADERS = {
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def parse_source(source: str) -> tuple[str, str]:
    """Parse "9575" or "shenzhen:9575" into (city, community_id)."""
    city, _, community_id = source.strip().rpartition(":")
    city = city or _DEFAULT_CITY
    if not re.fullmatch(r"[a-z]+", city) or not re.fullmatch(r"\d+", community_id):
        raise ValueError(f"Invalid community source: {source!r}")
    return city, community_id


def _latest_price_by_listing(existing_guids: list[str]) -> dict[str, str]:
    """Map listing id -> most recent known price. Guids are "{listingId}@{price}",
    ordered newest first, so the first occurrence per listing wins."""
    latest: dict[str, str] = {}
    for guid in existing_guids:
        listing_id, sep, price = guid.partition("@")
        if sep and listing_id not in latest:
            latest[listing_id] = price
    return latest


def _as_number(price: str) -> float:
    try:
        return float(price)
    except ValueError:
        return 0.0


def _build_post(listing: dict, source_label: str, prefix: str, extra_line: str) -> ScrapedPost:
    title = f"{prefix} | {listing['title']}" if prefix else listing["title"]

    lines = [f"<p><strong>总价：</strong>{listing['price']}万（{listing['unit_price']}）</p>"]
    if extra_line:
        lines.append(f"<p><strong>{extra_line}</strong></p>")
    lines.extend(f"<p>{line}</p>" for line in listing["attr_lines"])
    if listing["labels"]:
        lines.append(f"<p>{' / '.join(listing['labels'])}</p>")
    if listing["image"]:
        lines.append(f'<img src="{listing["image"]}" alt="{listing["title"]}">')
    lines.append(f'<p><a href="{listing["url"]}">在{source_label}查看房源</a></p>')

    media = [{"url": listing["image"], "type": "photo"}] if listing["image"] else []

    return ScrapedPost(
        guid=f"{listing['id']}@{listing['price']}",
        title=title,
        url=listing["url"],
        content="\n".join(lines),
        published_at=datetime.now(timezone.utc).isoformat(),
        author=listing["community"] or source_label,
        media=media,
    )


class CommunityListingScraper(BaseScraper):
    """Base for adapters that watch one residential community's resale listings.

    Source format: "{communityId}" or "{city}:{communityId}". Emits one post per
    (listing, price): a brand-new listing produces a 新上 post and a price change
    produces a 降价/涨价 post, with dedup handled by the API's (feedId, guid)
    constraint.
    """

    needs_existing_guids = True
    source_label = "来源"

    def __init__(self) -> None:
        self._last_run: dict[str, float] = {}

    async def scrape(
        self,
        source: str,
        existing_guids: list[str] | None = None,
        force: bool = False,
    ) -> list[ScrapedPost]:
        try:
            city, community_id = parse_source(source)
        except ValueError as exc:
            logger.error("%s: %s", type(self).__name__, exc)
            return []

        if not force and not self._should_run(source):
            return []

        try:
            listings = await self._fetch_listings(city, community_id)
        except Exception as exc:
            logger.error("%s failed for %s: %s", type(self).__name__, source, exc)
            return []
        return self._build_posts(listings, existing_guids)

    @abstractmethod
    async def _fetch_listings(self, city: str, community_id: str) -> list[dict]:
        """Fetch all current listings as dicts with keys: id, title, url,
        community, price, unit_price, attr_lines, labels, image."""
        ...

    def _should_run(self, source: str) -> bool:
        """Throttle scheduler runs — listing churn is daily-paced, and a full
        sweep is ~a dozen page fetches, so be polite to the source site."""
        min_interval = settings.community_min_scrape_interval_minutes * 60
        last = self._last_run.get(source, 0)
        if time.time() - last < min_interval:
            logger.info("%s: skipping %s (recently scraped)", type(self).__name__, source)
            return False
        self._last_run[source] = time.time()
        return True

    def _build_posts(
        self,
        listings: list[dict],
        existing_guids: list[str] | None,
    ) -> list[ScrapedPost]:
        # Without guid context (endpoint failure) labels are unknowable; with an
        # empty guid list this is a brand-new feed backfill. Neutral titles both ways.
        can_label = bool(existing_guids)
        latest_price = _latest_price_by_listing(existing_guids or [])

        posts: list[ScrapedPost] = []
        for listing in listings:
            prefix = ""
            extra_line = ""
            if can_label and listing["id"] not in latest_price:
                prefix = "🆕 新上"
            elif can_label and latest_price[listing["id"]] != listing["price"]:
                old, new = latest_price[listing["id"]], listing["price"]
                direction = "📉 降价" if _as_number(new) < _as_number(old) else "📈 涨价"
                prefix = f"{direction} {old}万→{new}万"
                extra_line = f"价格变动：{old}万 → {new}万"
            posts.append(_build_post(listing, self.source_label, prefix, extra_line))
        return posts
