import asyncio
import logging
import re

from curl_cffi.requests import AsyncSession
from scrapling.parser import Adaptor

from scraper.config import settings
from scraper.scrapers.community_base import HEADERS, IMPERSONATE, CommunityListingScraper

logger = logging.getLogger(__name__)

QFANG_LIST_URL = "https://{city}.qfang.com/garden/sale/{community_id}"
QFANG_PAGE_URL = "https://{city}.qfang.com/garden/sale/{community_id}/f{page}"
QFANG_BASE_URL = "https://{city}.qfang.com"

_MAX_PAGES = 20
_PAGE_DELAY_SECONDS = 0.8


def _parse_listing(item, city: str, community: str) -> dict | None:
    link = item.css_first(".house-title a")
    if link is None:
        return None
    href = link.attrib.get("href") or ""
    match = re.search(r"/sale/(\d+)", href)
    if not match:
        return None

    price_el = item.css_first(".show-price .sale-price")
    price = price_el.text.strip() if price_el else ""
    if not price:
        return None

    unit_price_el = item.css_first(".show-price p")
    about = [t.strip() for t in item.css(".house-about ::text") if t.strip()]
    img = item.css_first("a.show-image img")
    image_url = (img.attrib.get("src") or "") if img else ""

    return {
        "id": match.group(1),
        "title": " ".join(link.text.split()),
        "url": QFANG_BASE_URL.format(city=city) + href,
        "community": community,
        "price": price,
        "unit_price": unit_price_el.text.strip() if unit_price_el else "",
        "attr_lines": [" · ".join(about)] if about else [],
        "labels": [],
        "image": image_url,
    }


def _page_count(page: Adaptor) -> int:
    pages = [1]
    for el in page.css(".pagination-container .items"):
        if el.text.strip().isdigit():
            pages.append(int(el.text.strip()))
    return min(max(pages), _MAX_PAGES)


class QfangCommunityScraper(CommunityListingScraper):
    """Watches a Q房网/365淘好房 community's (garden) resale listings.

    Community id from https://{city}.qfang.com/garden/sale/{id}. Unlike
    Leyoujia, Q房网 serves every page anonymously, so coverage is complete.
    """

    source_label = "Q房网"

    async def _fetch_listings(self, city: str, community_id: str) -> list[dict]:
        listings: list[dict] = []
        async with AsyncSession(
            impersonate=IMPERSONATE,
            headers=HEADERS,
            timeout=settings.scrape_timeout_seconds,
        ) as session:
            first_page = await self._fetch_page(
                session, QFANG_LIST_URL.format(city=city, community_id=community_id)
            )
            community = self._community_name(first_page)
            listings.extend(self._parse_page(first_page, city, community))

            for page_no in range(2, _page_count(first_page) + 1):
                await asyncio.sleep(_PAGE_DELAY_SECONDS)
                page = await self._fetch_page(
                    session,
                    QFANG_PAGE_URL.format(city=city, community_id=community_id, page=page_no),
                )
                listings.extend(self._parse_page(page, city, community))

        return listings

    async def _fetch_page(self, session: AsyncSession, url: str) -> Adaptor:
        resp = await session.get(url)
        if resp.status_code != 200:
            raise RuntimeError(f"Qfang returned HTTP {resp.status_code} for {url}")
        return Adaptor(text=resp.text)

    def _community_name(self, page: Adaptor) -> str:
        header = page.css_first("h2.house-title")
        return header.text.strip() if header else ""

    def _parse_page(self, page: Adaptor, city: str, community: str) -> list[dict]:
        # Items are li blocks with a .show-image thumbnail; this also excludes
        # the footer link cloud of other communities.
        items = [li for li in page.css("li") if li.css_first("a.show-image")]
        return [listing for item in items if (listing := _parse_listing(item, city, community))]
