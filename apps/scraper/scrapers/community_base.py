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


# Area ("建筑面积89.4㎡" / "面积 89.4 ㎡") and layout ("3室2厅" / "四室两厅") — the
# two facts buyers scan for. Extracted from the title + attr lines; either may miss.
_AREA_RE = re.compile(r"(?:建筑面积|面积)?\s*([\d.]+)\s*(?:㎡|平)")
_ROOMS_RE = re.compile(r"([\d一二三四五六七八九十]+室[\d一二三四五六七八九十]+厅)")


def _extract_specs(listing: dict) -> tuple[str, str]:
    blob = " ".join([listing.get("title", ""), *listing.get("attr_lines", [])])
    area = _AREA_RE.search(blob)
    rooms = _ROOMS_RE.search(blob)
    return (area.group(1) if area else "", rooms.group(1) if rooms else "")


# Inline-styled "property card". The desktop/web reader renders inline styles by
# default (readerRenderInlineStyle=true); if a reader disables them the markup still
# degrades to a readable stack. Colors are picked to read on both light and dark:
# a warm red for the price (the convention in CN listings) and the brand yellow CTA.
_CARD = "border:1px solid rgba(120,120,128,0.22);border-radius:16px;padding:16px;max-width:560px"
_IMG = "width:100%;border-radius:12px;display:block;margin-bottom:14px"
_PRICE = "font-size:30px;font-weight:800;color:#ff4d3a;line-height:1.1"
_UNIT = "font-size:13px;opacity:0.55;margin-left:10px"
_DROP = "font-size:13px;font-weight:700;color:#ff4d3a;margin:10px 0 0"
_CHIPS = "display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 2px"
_CHIP = "font-size:13px;font-weight:600;padding:5px 12px;border-radius:999px;background:rgba(120,120,128,0.14)"
_HEADLINE = "font-size:14px;opacity:0.85;margin:12px 0;line-height:1.5"
_SPECS = "border-top:1px solid rgba(120,120,128,0.18);padding-top:10px;margin-top:12px"
_SPEC_ROW = "font-size:13px;opacity:0.72;padding:3px 0"
_CTA = (
    "display:inline-block;margin-top:14px;padding:9px 18px;border-radius:10px;"
    "background:#facc15;color:#1c1c1e;font-weight:600;font-size:13px;text-decoration:none"
)


def _build_post(listing: dict, source_label: str, prefix: str, extra_line: str) -> ScrapedPost:
    area, rooms = _extract_specs(listing)

    # Scannable title leads with what buyers compare: price · area · layout.
    facts = [f"{listing['price']}万"]
    if area:
        facts.append(f"{area}㎡")
    if rooms:
        facts.append(rooms)
    headline = " · ".join(facts)
    title = f"{prefix} | {headline}" if prefix else headline

    card = [f'<div style="{_CARD}">']
    # Hero image first — the listing photo is the strongest signal.
    if listing["image"]:
        card.append(f'<img src="{listing["image"]}" alt="{headline}" style="{_IMG}">')
    # Price hero + unit price.
    unit = f'<span style="{_UNIT}">{listing["unit_price"]}</span>' if listing["unit_price"] else ""
    card.append(f'<div><span style="{_PRICE}">{listing["price"]}万</span>{unit}</div>')
    # Price-change callout (降价/涨价).
    if extra_line:
        card.append(f'<div style="{_DROP}">{extra_line}</div>')
    # Area / layout / labels as pills.
    chips = [f"{area}㎡"] if area else []
    if rooms:
        chips.append(rooms)
    chips.extend(listing["labels"][:3])
    if chips:
        pills = "".join(f'<span style="{_CHIP}">{c}</span>' for c in chips)
        card.append(f'<div style="{_CHIPS}">{pills}</div>')
    # Original listing headline for context.
    if listing["title"]:
        card.append(f'<p style="{_HEADLINE}">{listing["title"]}</p>')
    # Descriptive attributes.
    if listing["attr_lines"]:
        rows = "".join(f'<div style="{_SPEC_ROW}">{line}</div>' for line in listing["attr_lines"])
        card.append(f'<div style="{_SPECS}">{rows}</div>')
    card.append(f'<a href="{listing["url"]}" style="{_CTA}">在{source_label}查看房源 →</a>')
    card.append("</div>")

    media = [{"url": listing["image"], "type": "photo"}] if listing["image"] else []

    return ScrapedPost(
        guid=f"{listing['id']}@{listing['price']}",
        title=title,
        url=listing["url"],
        content="\n".join(card),
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
