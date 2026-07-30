import hashlib
import json
import logging
import re
import time
from abc import abstractmethod
from datetime import datetime, timezone

from scraper.config import settings
from scraper.models import PropertyChange, PropertyInfo, PropertyPricePoint, ScrapedPost
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
        parts = guid.split("@", 2)
        if len(parts) >= 2 and parts[0] not in latest:
            latest[parts[0]] = parts[1]
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
        listing_id=listing["id"],
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
_BADGE_GREEN = "font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:7px;background:#30a46c;color:#fff"
_BADGE_BLUE = "font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:7px;background:#3e63dd;color:#fff"
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
    if pr.badge == "increased":
        badges.append(f'<span style="{_BADGE_GREEN}">涨价</span>')
    if pr.badge == "updated":
        badges.append(f'<span style="{_BADGE_BLUE}">信息更新</span>')
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

    if pr.changes:
        changes = "；".join(f"{change.old or '—'} → {change.new or '—'}" for change in pr.changes[:3])
        parts.append(f'<div style="{_DETAIL};margin-top:12px">本次更新：{changes}</div>')

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
    property_info: PropertyInfo | None = None,
    guid: str | None = None,
    published_at: str | None = None,
) -> ScrapedPost:
    pr = property_info or _build_property(listing, city, badge, reduced_by, orig)

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
        guid=guid or f"{listing['id']}@{listing['price']}",
        title=title,
        url=listing["url"],
        content=_card_html(pr, listing["url"], "刚刚监测", source_label),
        published_at=published_at or datetime.now(timezone.utc).isoformat(),
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
    needs_existing_posts = True
    source_label = "来源"

    def __init__(self) -> None:
        self._last_run: dict[str, float] = {}

    async def scrape(
        self,
        source: str,
        existing_guids: list[str] | None = None,
        existing_posts: list[dict] | None = None,
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
        return self._build_posts(listings, existing_guids, city, existing_posts)

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
        existing_posts: list[dict] | None = None,
    ) -> list[ScrapedPost]:
        # Without guid context (endpoint failure) labels are unknowable; with an
        # empty guid list this is a brand-new feed backfill. Neutral titles both ways.
        can_label = bool(existing_guids)
        latest_price = _latest_price_by_listing(existing_guids or [])

        history_by_listing: dict[str, list[dict]] = {}
        for post in existing_posts or []:
            guid = post.get("guid", "")
            listing_id = guid.split("@", 1)[0]
            if listing_id and post.get("property"):
                history_by_listing.setdefault(listing_id, []).append(post)

        # Every listing in one response was observed in the same scrape. Using
        # one timestamp avoids inventing a microsecond ordering within the page.
        observed_at = datetime.now(timezone.utc).isoformat()
        posts: list[ScrapedPost] = []
        for listing in listings:
            listing_id = listing["id"]
            prefix = ""
            badge = ""
            reduced_by = ""
            orig = ""
            property_info = _build_property(listing, city, badge, reduced_by, orig)
            listing_history = history_by_listing.get(listing_id, [])
            previous_post = listing_history[0] if listing_history else None
            previous_property = previous_post.get("property") if previous_post else None
            property_info.first_seen_at = _first_seen_at(listing_history, observed_at)
            property_info.observed_at = observed_at
            changes = _property_changes(property_info, previous_property)

            if can_label and listing_id not in latest_price:
                prefix = "🆕 新上"
                badge = "new"
                property_info.event = "new"
            elif can_label and latest_price[listing_id] != listing["price"]:
                old, new = latest_price[listing_id], listing["price"]
                down = _as_number(new) < _as_number(old)
                direction = "📉 降价" if down else "📈 涨价"
                prefix = f"{direction} {old}万→{new}万"
                property_info.event = "price_down" if down else "price_up"
                property_info.price_change_num = (_as_number(new) - _as_number(old)) * 10000
                property_info.price_change_percent = (
                    (_as_number(new) - _as_number(old)) / _as_number(old) * 100
                    if _as_number(old)
                    else 0
                )
                orig = f"{old}万"
                if down:
                    badge = "reduced"
                    reduced_by = f"{_as_number(old) - _as_number(new):g}万"
                else:
                    badge = "increased"
            elif changes:
                fields = "、".join(_CHANGE_LABELS[change.field] for change in changes[:3])
                prefix = f"📝 信息更新 {fields}"
                badge = "updated"
                property_info.event = "details_changed"

            if previous_property and any(change.field == "price" for change in changes):
                old_num = float(previous_property.get("total_num") or 0)
                property_info.price_change_num = property_info.total_num - old_num
                property_info.price_change_percent = (
                    property_info.price_change_num / old_num * 100 if old_num else 0
                )
                property_info.event = (
                    "price_down" if property_info.price_change_num < 0 else "price_up"
                )
                badge = "reduced" if property_info.price_change_num < 0 else "increased"
                orig = previous_property.get("total", "")
                if property_info.price_change_num < 0:
                    reduced_by = f"{abs(property_info.price_change_num) / 10000:g}万"

            property_info.badge = badge
            property_info.reduced_by = reduced_by
            property_info.orig = orig
            property_info.changes = changes
            property_info.price_history = _price_history(
                property_info, listing_history, observed_at
            )

            guid = f"{listing_id}@{listing['price']}"
            if previous_post:
                if not changes:
                    guid = previous_post["guid"]
                else:
                    fingerprint = _property_fingerprint(property_info)
                    previous_version = hashlib.sha256(previous_post["guid"].encode()).hexdigest()[:8]
                    guid = f"{listing_id}@{listing['price']}@{fingerprint}@{previous_version}"
            posts.append(
                _build_post(
                    listing,
                    self.source_label,
                    prefix,
                    city,
                    badge,
                    reduced_by,
                    orig,
                    property_info=property_info,
                    guid=guid,
                    published_at=observed_at,
                )
            )
        return posts


_CHANGE_LABELS = {
    "price": "总价",
    "unit_price": "单价",
    "title": "标题",
    "area": "面积",
    "layout": "户型",
    "floor": "楼层",
    "orientation": "朝向",
    "renovation": "装修",
    "tags": "标签",
}


def _layout_value(property_info: PropertyInfo | dict) -> str:
    def value(key: str):
        if isinstance(property_info, dict):
            return property_info.get(key, 0)
        return getattr(property_info, key)

    return "".join(
        part
        for part in [
            f"{value('beds')}室" if value("beds") else "",
            f"{value('halls')}厅" if value("halls") else "",
            f"{value('baths')}卫" if value("baths") else "",
        ]
        if part
    )


def _display_value(property_info: PropertyInfo | dict, field: str) -> str:
    def value(key: str):
        if isinstance(property_info, dict):
            return property_info.get(key)
        return getattr(property_info, key)

    if field == "layout":
        return _layout_value(property_info)
    if field == "area":
        area = float(value("area") or 0)
        return f"{area:g}㎡" if area else ""
    if field == "tags":
        return "、".join(sorted(value("tags") or []))
    key = {
        "price": "total",
        "unit_price": "unit",
        "renovation": "reno",
    }.get(field, field)
    return str(value(key) or "")


def _property_changes(current: PropertyInfo, previous: dict | None) -> list[PropertyChange]:
    if not previous:
        return []
    changes = []
    fields = [
        "price",
        "unit_price",
        "title",
        "area",
        "layout",
        "floor",
        "orientation",
        "renovation",
        "tags",
    ]
    for field in fields:
        old = _display_value(previous, field)
        new = _display_value(current, field)
        if old != new:
            changes.append(PropertyChange(field=field, old=old, new=new))
    return changes


def _property_fingerprint(property_info: PropertyInfo) -> str:
    tracked = {
        field: _display_value(property_info, field)
        for field in _CHANGE_LABELS
    }
    payload = json.dumps(tracked, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()[:12]


def _first_seen_at(listing_history: list[dict], observed_at: str) -> str:
    candidates = []
    for post in listing_history:
        first_seen_at = (post.get("property") or {}).get("first_seen_at")
        if first_seen_at:
            candidates.append(first_seen_at)
        if post.get("published_at"):
            candidates.append(post["published_at"])

    if not candidates:
        return observed_at
    return min(
        candidates,
        key=lambda value: datetime.fromisoformat(value.replace("Z", "+00:00")),
    )


def _price_history(
    current: PropertyInfo,
    listing_history: list[dict],
    published_at: str,
) -> list[PropertyPricePoint]:
    points = [
        PropertyPricePoint(
            total=current.total,
            total_num=current.total_num,
            changed_at=published_at,
        )
    ]
    candidates = []
    for post in listing_history:
        previous = post.get("property") or {}
        candidates.append(
            {
                "total": previous.get("total"),
                "total_num": previous.get("total_num"),
                "changed_at": post.get("published_at"),
            }
        )
        embedded_history = previous.get("price_history") or []
        if embedded_history and float(embedded_history[0].get("total_num") or 0) == float(
            previous.get("total_num") or 0
        ):
            candidates.extend(embedded_history)

    for candidate in candidates:
        total_num = float(candidate.get("total_num") or 0)
        changed_at = candidate.get("changed_at")
        if not total_num or not changed_at or total_num == points[-1].total_num:
            continue
        points.append(
            PropertyPricePoint(
                total=candidate.get("total") or f"{total_num / 10000:g}万",
                total_num=total_num,
                changed_at=changed_at,
            )
        )
        if len(points) == 50:
            break
    return points
