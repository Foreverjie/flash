import logging
import re
import time
from abc import abstractmethod
from datetime import datetime, timezone

from scraper.config import settings
from scraper.models import PropertyInfo, ScrapedPost
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


_CN_NUM = {"一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def _to_int(s: str) -> int:
    return int(s) if s.isdigit() else _CN_NUM.get(s, 0)


# Facts buyers scan for, extracted from the title + attr lines (any may miss).
_AREA_RE = re.compile(r"(?:建筑面积|面积)?\s*([\d.]+)\s*(?:㎡|平)")
_LAYOUT_RE = re.compile(
    r"([\d一二三四五六七八九十]+)室([\d一二三四五六七八九十]+)厅(?:([\d一二三四五六七八九十]+)卫)?"
)
_ORIENT_RE = re.compile(r"(东南|东北|西南|西北|南北|东|南|西|北)")
_RENO_RE = re.compile(r"(豪华装修|精装修|简装修|毛坯房|精装|简装|豪装|中装|普装|毛坯|清水|洋房)")
_FLOOR_RE = re.compile(r"((?:低|中|高)楼层(?:\(共\d+层\))?|\d+层(?:\(共\d+层\))?)")
_UNITNUM_RE = re.compile(r"([\d,]+)\s*元")

_CITY_NAMES = {
    "shenzhen": "深圳",
    "guangzhou": "广州",
    "shanghai": "上海",
    "beijing": "北京",
    "dongguan": "东莞",
    "foshan": "佛山",
    "hangzhou": "杭州",
}


def _first(pattern: re.Pattern, blob: str) -> str:
    m = pattern.search(blob)
    return m.group(1) if m else ""


def _build_property(
    listing: dict,
    city: str,
    badge: str,
    reduced_by: str,
    orig: str,
) -> PropertyInfo:
    """Structured listing data (the mandatory Property Feed field)."""
    attrs = listing.get("attr_lines", [])
    blob = " ".join([listing.get("title", ""), *attrs])

    area = _first(_AREA_RE, blob)
    layout = _LAYOUT_RE.search(blob)
    if layout:
        beds = _to_int(layout.group(1))
        halls = _to_int(layout.group(2))
        baths = _to_int(layout.group(3)) if layout.group(3) else 0
    else:
        # Fallback for listings phrased as "五房" / "3房" with no 室厅 breakdown.
        rooms_only = re.search(r"([\d一二三四五六七八九十]+)房", blob)
        beds = _to_int(rooms_only.group(1)) if rooms_only else 0
        halls = baths = 0

    # Location: last attr line usually carries district/metro; take the district head.
    hood = ""
    for line in reversed(attrs):
        if "-" in line or "距" in line or "区" in line:
            hood = re.split(r"\s*·\s*|\s*距", line)[0].strip()
            break

    unit_num = _UNITNUM_RE.search(listing.get("unit_price", ""))

    return PropertyInfo(
        community=listing.get("community") or "",
        title=listing.get("title", ""),
        city=_CITY_NAMES.get(city, city),
        hood=hood,
        beds=beds,
        halls=halls,
        baths=baths,
        area=_as_number(area),
        total=f"{listing['price']}万",
        total_num=_as_number(listing["price"]) * 10000,
        unit=listing.get("unit_price", ""),
        unit_num=_as_number(unit_num.group(1).replace(",", "")) if unit_num else 0,
        floor=_first(_FLOOR_RE, blob),
        orientation=_first(_ORIENT_RE, blob),
        reno=_first(_RENO_RE, blob),
        tags=list(listing.get("labels", [])),
        badge=badge,
        reduced_by=reduced_by,
        orig=orig,
        sold=bool(listing.get("sold")),
        image=listing.get("image", ""),
    )


# ── Inline-styled property card ───────────────────────────────────────────────
# The reader renders inline styles by default (readerRenderInlineStyle=true) and
# degrades to a readable stack otherwise. Colors read on both light and dark:
# text inherits the reader theme; badges/CTA use fixed brand values.
_CARD = "border:1px solid rgba(120,120,128,0.2);border-radius:16px;overflow:hidden;max-width:560px"
_IMG = "width:100%;aspect-ratio:16/9;object-fit:cover;display:block"
_BODY = "padding:16px"
_HEADROW = "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px"
_COMMUNITY = "font-size:13px;font-weight:600;color:#c79a2e"
_UPDATED = "font-size:11.5px;opacity:0.5"
_TITLE = "margin:0 0 10px;font-size:16px;font-weight:600;line-height:1.35"
_PRICE = "font-size:28px;font-weight:800;letter-spacing:-0.02em;line-height:1"
_UNIT = "font-size:13px;opacity:0.55;margin-left:10px"
_ORIG = "font-size:12.5px;opacity:0.45;text-decoration:line-through;margin-left:8px"
_META = "display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0;font-size:13px;font-weight:600"
_DIV = "height:1px;background:rgba(120,120,128,0.2);margin:12px 0"
_LOC = "font-size:13px;opacity:0.85;margin-bottom:6px"
_DETAIL = "font-size:12.5px;opacity:0.6"
_CHIPS = "display:flex;flex-wrap:wrap;gap:6px;margin-top:12px"
_CHIP = "font-size:11.5px;font-weight:500;padding:4px 10px;border-radius:7px;background:rgba(120,120,128,0.14)"
_CTA = (
    "display:inline-flex;align-items:center;gap:6px;margin-top:14px;padding:9px 16px;border-radius:10px;"
    "background:#facc15;color:#1a1207;font-weight:600;font-size:13px;text-decoration:none"
)
_BADGE_NEW = "font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:7px;background:#facc15;color:#1a1207"
_BADGE_RED = "font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:7px;background:#e5484d;color:#fff"
_BADGE_SOLD = "font-size:11.5px;font-weight:700;letter-spacing:0.08em;padding:3px 9px;border-radius:7px;background:rgba(20,25,25,0.72);color:#fff"


def _card_html(pr: PropertyInfo, url: str, updated: str, source_label: str) -> str:
    parts = [f'<div style="{_CARD}">']
    if pr.image:
        parts.append(f'<img src="{pr.image}" alt="{pr.community}" style="{_IMG}">')

    parts.append(f'<div style="{_BODY}">')

    # Badges row
    badges = []
    if pr.sold:
        badges.append(f'<span style="{_BADGE_SOLD}">SOLD 已售</span>')
    if pr.badge == "new":
        badges.append(f'<span style="{_BADGE_NEW}">新上</span>')
    if pr.badge == "reduced":
        drop = f" {pr.reduced_by}" if pr.reduced_by else ""
        badges.append(f'<span style="{_BADGE_RED}">降价{drop}</span>')
    if badges:
        parts.append(f'<div style="display:flex;gap:6px;margin-bottom:10px">{"".join(badges)}</div>')

    # Community + updated
    parts.append(
        f'<div style="{_HEADROW}"><span style="{_COMMUNITY}">{pr.community}</span>'
        f'<span style="{_UPDATED}">🕐 {updated}</span></div>'
    )

    # Listing headline
    if pr.title:
        parts.append(f'<h3 style="{_TITLE}">{pr.title}</h3>')

    # Price
    price = f'<span style="{_PRICE}">{pr.total}</span>'
    if pr.unit:
        price += f'<span style="{_UNIT}">{pr.unit}</span>'
    if pr.badge == "reduced" and pr.orig:
        price += f'<span style="{_ORIG}">{pr.orig}</span>'
    parts.append(f"<div>{price}</div>")

    # Meta: layout + area
    meta = []
    if pr.beds:
        meta.append(f"🛏 {pr.beds}室")
    if pr.halls:
        meta.append(f"🛋 {pr.halls}厅")
    if pr.baths:
        meta.append(f"🚿 {pr.baths}卫")
    if pr.area:
        meta.append(f"📐 {pr.area:g}㎡")
    if meta:
        cells = '<span style="opacity:0.35">·</span>'.join(f"<span>{m}</span>" for m in meta)
        parts.append(f'<div style="{_META}">{cells}</div>')

    parts.append(f'<div style="{_DIV}"></div>')

    # Location + detail line
    loc = " · ".join(x for x in [pr.hood, pr.city] if x)
    if loc:
        parts.append(f'<div style="{_LOC}">📍 {loc}</div>')
    detail = " · ".join(
        x for x in [pr.floor, f"{pr.orientation}向" if pr.orientation else "", pr.reno] if x
    )
    if detail:
        parts.append(f'<div style="{_DETAIL}">{detail}</div>')

    # Tags
    if pr.tags:
        chips = "".join(f'<span style="{_CHIP}">{t}</span>' for t in pr.tags)
        parts.append(f'<div style="{_CHIPS}">{chips}</div>')

    # CTA
    label = "已售出" if pr.sold else "查看详情"
    parts.append(f'<a href="{url}" style="{_CTA}">在{source_label}{label} →</a>')

    parts.append("</div></div>")
    return "\n".join(parts)


def _build_post(
    listing: dict,
    source_label: str,
    prefix: str,
    city: str,
    badge: str = "",
    reduced_by: str = "",
    orig: str = "",
) -> ScrapedPost:
    pr = _build_property(listing, city, badge, reduced_by, orig)

    # Scannable title leads with what buyers compare: price · area · layout.
    facts = [pr.total]
    if pr.area:
        facts.append(f"{pr.area:g}㎡")
    if pr.beds:
        facts.append(f"{pr.beds}室{pr.halls}厅" if pr.halls else f"{pr.beds}室")
    headline = " · ".join(facts)
    title = f"{prefix} | {headline}" if prefix else headline

    media = [{"url": pr.image, "type": "photo"}] if pr.image else []

    return ScrapedPost(
        guid=f"{listing['id']}@{listing['price']}",
        title=title,
        url=listing["url"],
        content=_card_html(pr, listing["url"], "刚刚更新", source_label),
        published_at=datetime.now(timezone.utc).isoformat(),
        author=pr.community or source_label,
        media=media,
        property=pr,
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
        return self._build_posts(listings, existing_guids, city)

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
        city: str = _DEFAULT_CITY,
    ) -> list[ScrapedPost]:
        # Without guid context (endpoint failure) labels are unknowable; with an
        # empty guid list this is a brand-new feed backfill. Neutral titles both ways.
        can_label = bool(existing_guids)
        latest_price = _latest_price_by_listing(existing_guids or [])

        posts: list[ScrapedPost] = []
        for listing in listings:
            prefix = ""
            badge = ""
            reduced_by = ""
            orig = ""
            if can_label and listing["id"] not in latest_price:
                prefix = "🆕 新上"
                badge = "new"
            elif can_label and latest_price[listing["id"]] != listing["price"]:
                old, new = latest_price[listing["id"]], listing["price"]
                down = _as_number(new) < _as_number(old)
                direction = "📉 降价" if down else "📈 涨价"
                prefix = f"{direction} {old}万→{new}万"
                if down:
                    badge = "reduced"
                    reduced_by = f"{_as_number(old) - _as_number(new):g}万"
                    orig = f"{old}万"
            posts.append(
                _build_post(listing, self.source_label, prefix, city, badge, reduced_by, orig)
            )
        return posts
