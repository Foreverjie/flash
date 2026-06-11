import logging
import re

from curl_cffi.requests import AsyncSession
from scrapling.parser import Adaptor

from scraper.config import settings
from scraper.scrapers.community_base import HEADERS, IMPERSONATE, CommunityListingScraper

logger = logging.getLogger(__name__)

LEYOUJIA_LIST_URL = "https://{city}.leyoujia.com/xq/detail/esf/{community_id}"
LEYOUJIA_DETAIL_URL = "https://{city}.leyoujia.com/esf/detail/{listing_id}"


def _text_parts(node) -> list[str]:
    """All meaningful text fragments of a node, excluding the '|' separators."""
    return [t.strip() for t in node.css("::text") if t.strip() and t.strip() != "|"]


def _parse_listing(item, city: str) -> dict | None:
    link = item.css_first(".text .tit a")
    if link is None:
        return None
    href = link.attrib.get("href") or ""
    match = re.search(r"/esf/detail/([A-Za-z0-9]+)", href)
    if not match:
        return None

    price_el = item.css_first(".price .salePrice")
    price = price_el.text.strip() if price_el else ""
    if not price:
        return None

    unit_price_el = item.css_first(".price .sub")
    attr_lines = [" · ".join(_text_parts(p)) for p in item.css(".text p.attr")]
    first_parts = _text_parts(item.css(".text p.attr")[0]) if attr_lines else []
    img = item.css_first(".img img")
    image_url = (img.attrib.get("data-original") or "").split("?")[0] if img else ""

    return {
        "id": match.group(1),
        "title": (link.attrib.get("title") or link.text or "").strip(),
        "url": LEYOUJIA_DETAIL_URL.format(city=city, listing_id=match.group(1)),
        "community": first_parts[0] if first_parts else "",
        "price": price,
        "unit_price": unit_price_el.text.strip() if unit_price_el else "",
        "attr_lines": attr_lines,
        "labels": [lab.text.strip() for lab in item.css(".labs .lab") if lab.text.strip()],
        "image": image_url,
    }


class LeyoujiaCommunityScraper(CommunityListingScraper):
    """Watches a Leyoujia (乐有家) community's resale listings.

    Community id from https://{city}.leyoujia.com/xq/detail/{id}.

    Leyoujia login-walls sorting and pages beyond the first, so anonymous
    access only sees the default-ranked first page (~20 listings). Smaller
    communities are covered completely; for larger ones this tracks the
    default-ranked top listings only.
    """

    source_label = "乐有家"

    async def _fetch_listings(self, city: str, community_id: str) -> list[dict]:
        async with AsyncSession(
            impersonate=IMPERSONATE,
            headers=HEADERS,
            timeout=settings.scrape_timeout_seconds,
        ) as session:
            page = await self._fetch_page(
                session, LEYOUJIA_LIST_URL.format(city=city, community_id=community_id)
            )
        return self._parse_page(page, city)

    async def _fetch_page(self, session: AsyncSession, url: str) -> Adaptor:
        resp = await session.get(url)
        if resp.status_code != 200:
            raise RuntimeError(f"Leyoujia returned HTTP {resp.status_code} for {url}")
        if "/login" in str(resp.url):
            raise RuntimeError(f"Leyoujia redirected to login wall for {url}")
        return Adaptor(text=resp.text)

    def _parse_page(self, page: Adaptor, city: str) -> list[dict]:
        # Scope to .left-box: the right sidebar (周边二手房) reuses li.item for
        # listings from *other* communities.
        items = page.css(".left-box .list-box li.item")
        return [listing for item in items if (listing := _parse_listing(item, city))]
